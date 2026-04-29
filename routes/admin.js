const express = require('express')
const pool = require('../config/database')
const { authenticateToken, requireRole } = require('../middleware/auth')

const router = express.Router()

// Get all pending bookings
router.get('/bookings/pending', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, u.name as patient_name, u.email as patient_email
       FROM bookings b
       JOIN users u ON b.patient_id = u.id
       WHERE b.status = 'pending'
       ORDER BY b.created_at ASC`
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching pending bookings:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get all bookings
router.get('/bookings', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, 
              u.name as patient_name, 
              u.email as patient_email,
              pu.name as provider_name,
              p.provider_type
       FROM bookings b
       JOIN users u ON b.patient_id = u.id
       LEFT JOIN users pu ON b.assigned_provider_id = pu.id
       LEFT JOIN providers p ON pu.id = p.user_id
       ORDER BY b.created_at DESC`
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching all bookings:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get available providers
router.get('/providers', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { serviceType } = req.query
    
    let query = `
      SELECT u.id, u.name, u.email, p.provider_type
      FROM users u
      JOIN providers p ON u.id = p.user_id
      WHERE u.role = 'provider' AND u.status = 'active'
    `
    
    const params = []
    
    if (serviceType) {
      // Map service types to provider types
      const serviceToProviderMap = {
        'nursing': 'nurse',
        'doctor': 'doctor',
        'caregiver': 'caregiver'
      }
      
      const providerType = serviceToProviderMap[serviceType]
      if (providerType) {
        query += ' AND p.provider_type = $1'
        params.push(providerType)
      }
    }
    
    query += ' ORDER BY u.name'
    
    const result = await pool.query(query, params)
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching providers:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Assign provider to booking
router.post('/bookings/:id/assign', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const bookingId = req.params.id
    const { providerId, ratePerDay, days } = req.body

    const parsedDays = parseInt(days)
    const parsedRate = parseFloat(ratePerDay)

    if (!providerId) return res.status(400).json({ message: 'Provider ID is required' })
    if (!parsedRate || parsedRate <= 0) return res.status(400).json({ message: 'Valid rate per day is required' })
    if (!parsedDays || parsedDays <= 0) return res.status(400).json({ message: 'Valid number of days is required' })

    const totalPrice = parsedRate * parsedDays

    const result = await pool.query(
      `UPDATE bookings 
       SET assigned_provider_id = $1, price = $2, rate_per_day = $3, days = $4, status = $5 
       WHERE id = $6 RETURNING *`,
      [providerId, totalPrice, parsedRate, parsedDays, 'assigned', bookingId]
    )

    if (result.rows.length === 0) return res.status(404).json({ message: 'Booking not found' })

    const booking = result.rows[0]

    // Create payment record
    await pool.query(
      'INSERT INTO payments (booking_id, amount, status) VALUES ($1, $2, $3)',
      [bookingId, totalPrice, 'unpaid']
    )

    // Notify patient
    await pool.query(
      'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)',
      [booking.patient_id, 
       `A provider has been assigned to your ${booking.service_type} service. Rate: UGX ${parsedRate.toLocaleString()}/day × ${parsedDays} day(s) = UGX ${totalPrice.toLocaleString()} total.`,
       'provider_assigned']
    )

    // Notify provider
    await pool.query(
      'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)',
      [providerId, 
       `You have been assigned a new ${booking.service_type} service for ${parsedDays} day(s) at UGX ${parsedRate.toLocaleString()}/day. Total: UGX ${totalPrice.toLocaleString()}.`,
       'assignment_received']
    )

    res.json({ ...booking, totalPrice })
  } catch (error) {
    console.error('Error assigning provider:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get system statistics
router.get('/stats', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const stats = {}

    // Total bookings
    const totalBookings = await pool.query('SELECT COUNT(*) FROM bookings')
    stats.totalBookings = parseInt(totalBookings.rows[0].count)

    // Bookings by status
    const statusStats = await pool.query(
      'SELECT status, COUNT(*) FROM bookings GROUP BY status'
    )
    stats.bookingsByStatus = statusStats.rows.reduce((acc, row) => {
      acc[row.status] = parseInt(row.count)
      return acc
    }, {})

    // Total users by role
    const userStats = await pool.query(
      'SELECT role, COUNT(*) FROM users WHERE status = $1 GROUP BY role',
      ['active']
    )
    stats.usersByRole = userStats.rows.reduce((acc, row) => {
      acc[row.role] = parseInt(row.count)
      return acc
    }, {})

    // Total payments and revenue — sum from paid payments
    const paymentStats = await pool.query(
      `SELECT COUNT(*) as total, COALESCE(SUM(p.amount), 0) as total_amount 
       FROM payments p WHERE p.status = 'paid'`
    )
    stats.totalPayments = parseInt(paymentStats.rows[0].total)
    stats.totalRevenue = parseFloat(paymentStats.rows[0].total_amount)

    // Per-patient revenue breakdown
    const perPatientStats = await pool.query(
      `SELECT u.name as patient_name, u.email as patient_email,
              COUNT(b.id) as booking_count,
              COALESCE(SUM(b.price), 0) as total_billed,
              COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END), 0) as total_paid
       FROM users u
       JOIN bookings b ON u.id = b.patient_id
       LEFT JOIN payments p ON b.id = p.booking_id
       WHERE u.role = 'patient'
       GROUP BY u.id, u.name, u.email
       ORDER BY total_billed DESC`
    )
    stats.perPatientRevenue = perPatientStats.rows

    // Monthly revenue
    const monthlyStats = await pool.query(
      `SELECT SUM(amount) as monthly_amount FROM payments 
       WHERE status = $1 AND EXTRACT(MONTH FROM payment_date) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(YEAR FROM payment_date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
      ['paid']
    )
    stats.monthlyRevenue = parseFloat(monthlyStats.rows[0].monthly_amount || 0)

    res.json(stats)
  } catch (error) {
    console.error('Error fetching stats:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get earnings overview for admin
router.get('/earnings', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.booking_id, p.amount, p.payment_date,
              b.service_type,
              u.name as patient_name,
              pu.name as provider_name
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       JOIN users u ON b.patient_id = u.id
       JOIN users pu ON b.assigned_provider_id = pu.id
       WHERE p.status = 'paid'
       ORDER BY p.payment_date DESC`
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching earnings:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get pending admin requests
router.get('/admin-requests', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ar.*, u.name, u.email, u.created_at as user_created_at
       FROM admin_requests ar
       JOIN users u ON ar.user_id = u.id
       WHERE ar.status = 'pending' AND ar.type = 'admin_request'
       ORDER BY ar.created_at ASC`
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching admin requests:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get pending provider approvals
router.get('/provider-requests', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ar.*, u.name, u.email, u.phone, u.created_at as user_created_at,
              p.provider_type, p.availability, p.experience, p.qualifications,
              p.license_number, p.bio, p.location,
              p.doc_license_url, p.doc_certificate_url, p.doc_cv_url
       FROM admin_requests ar
       JOIN users u ON ar.user_id = u.id
       JOIN providers p ON u.id = p.user_id
       WHERE ar.status = 'pending' AND ar.type = 'provider_approval'
       ORDER BY ar.created_at ASC`
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching provider requests:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Approve/Reject provider request
router.post('/provider-requests/:id/:action', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const requestId = req.params.id
    const action = req.params.action // 'approve' or 'reject'
    
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action' })
    }

    // Get the request
    const requestResult = await pool.query(
      'SELECT * FROM admin_requests WHERE id = $1 AND type = $2',
      [requestId, 'provider_approval']
    )

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ message: 'Provider request not found' })
    }

    const providerRequest = requestResult.rows[0]

    // Update request status
    await pool.query(
      'UPDATE admin_requests SET status = $1, approved_by = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [action === 'approve' ? 'approved' : 'rejected', req.user.id, requestId]
    )

    if (action === 'approve') {
      // Activate the provider
      await pool.query(
        'UPDATE users SET status = $1 WHERE id = $2',
        ['active', providerRequest.user_id]
      )

      // Notify the provider
      await pool.query(
        'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)',
        [providerRequest.user_id, 'Congratulations! Your provider application has been approved. You can now login and start receiving assignments.', 'provider_approved']
      )

      res.json({ message: 'Provider approved successfully' })
    } else {
      // Notify the provider of rejection
      await pool.query(
        'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)',
        [providerRequest.user_id, 'Your provider application has been rejected. Contact support for more information.', 'provider_rejected']
      )

      res.json({ message: 'Provider application rejected' })
    }
  } catch (error) {
    console.error('Error processing provider request:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Approve/Reject admin request
router.post('/admin-requests/:id/:action', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const requestId = req.params.id
    const action = req.params.action // 'approve' or 'reject'
    
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action' })
    }

    // Get the request
    const requestResult = await pool.query(
      'SELECT * FROM admin_requests WHERE id = $1',
      [requestId]
    )

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ message: 'Admin request not found' })
    }

    const adminRequest = requestResult.rows[0]

    // Update request status
    await pool.query(
      'UPDATE admin_requests SET status = $1, approved_by = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [action === 'approve' ? 'approved' : 'rejected', req.user.id, requestId]
    )

    if (action === 'approve') {
      // Activate the user
      await pool.query(
        'UPDATE users SET status = $1 WHERE id = $2',
        ['active', adminRequest.user_id]
      )

      // Notify the user
      await pool.query(
        'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)',
        [adminRequest.user_id, 'Your admin access request has been approved! You can now login.', 'admin_approved']
      )

      res.json({ message: 'Admin request approved successfully' })
    } else {
      // Notify the user of rejection
      await pool.query(
        'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)',
        [adminRequest.user_id, 'Your admin access request has been rejected. Contact support for more information.', 'admin_rejected']
      )

      res.json({ message: 'Admin request rejected' })
    }
  } catch (error) {
    console.error('Error processing admin request:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router