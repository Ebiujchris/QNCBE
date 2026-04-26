const express = require('express')
const pool = require('../config/database')
const { authenticateToken, requireRole } = require('../middleware/auth')

const router = express.Router()

// Create booking (patients only)
router.post('/', authenticateToken, requireRole(['patient']), async (req, res) => {
  try {
    const { serviceType, description, location, phoneNumber, preferredDate, urgency } = req.body
    const patientId = req.user.id

    const result = await pool.query(
      `INSERT INTO bookings (patient_id, service_type, description, location, phone_number, preferred_date, urgency, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
      [patientId, serviceType, description, location, phoneNumber, preferredDate, urgency || 'normal']
    )

    const booking = result.rows[0]

    // Create notification for admin
    await pool.query(
      `INSERT INTO notifications (user_id, message, type) 
       SELECT id, $1, 'booking_created' FROM users WHERE role = 'admin'`,
      [`New booking request from ${req.user.name} for ${serviceType} service`]
    )

    res.status(201).json(booking)
  } catch (error) {
    console.error('Booking creation error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get patient's bookings
router.get('/my-bookings', authenticateToken, requireRole(['patient']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, 
              u.name as assigned_provider_name, 
              u.email as assigned_provider_email,
              u.phone as assigned_provider_phone,
              p.provider_type as assigned_provider_type
       FROM bookings b
       LEFT JOIN users u ON b.assigned_provider_id = u.id
       LEFT JOIN providers p ON u.id = p.user_id
       WHERE b.patient_id = $1 
       ORDER BY b.created_at DESC`,
      [req.user.id]
    )

    const bookings = result.rows.map(booking => ({
      ...booking,
      assignedProvider: booking.assigned_provider_name ? {
        name: booking.assigned_provider_name,
        email: booking.assigned_provider_email,
        phone: booking.assigned_provider_phone,
        providerType: booking.assigned_provider_type
      } : null
    }))

    res.json(bookings)
  } catch (error) {
    console.error('Error fetching bookings:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get provider's assignments
router.get('/my-assignments', authenticateToken, requireRole(['provider']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, u.name as patient_name, u.email as patient_email, u.phone as patient_phone
       FROM bookings b
       JOIN users u ON b.patient_id = u.id
       WHERE b.assigned_provider_id = $1 
       ORDER BY b.created_at DESC`,
      [req.user.id]
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching assignments:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Mark service as completed (providers only)
router.post('/:id/complete', authenticateToken, requireRole(['provider']), async (req, res) => {
  try {
    const bookingId = req.params.id

    const result = await pool.query(
      'UPDATE bookings SET status = $1 WHERE id = $2 AND assigned_provider_id = $3 RETURNING *',
      ['completed', bookingId, req.user.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Booking not found or not assigned to you' })
    }

    const booking = result.rows[0]

    // Notify patient
    await pool.query(
      'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)',
      [booking.patient_id, `Your ${booking.service_type} service has been completed`, 'service_completed']
    )

    res.json(booking)
  } catch (error) {
    console.error('Error completing service:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get provider earnings
router.get('/provider/earnings', authenticateToken, requireRole(['provider']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.booking_id, p.amount, p.payment_date,
              b.service_type,
              u.name as patient_name
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       JOIN users u ON b.patient_id = u.id
       WHERE b.assigned_provider_id = $1 AND p.status = 'paid'
       ORDER BY p.payment_date DESC`,
      [req.user.id]
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching provider earnings:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router