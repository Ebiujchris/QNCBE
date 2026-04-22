const express = require('express')
const pool = require('../config/database')
const { authenticateToken, requireRole } = require('../middleware/auth')

const router = express.Router()

// Mark payment as paid (patients only)
router.post('/:bookingId/mark-paid', authenticateToken, requireRole(['patient']), async (req, res) => {
  try {
    const bookingId = req.params.bookingId

    // Check if booking belongs to patient and is assigned
    const bookingResult = await pool.query(
      'SELECT * FROM bookings WHERE id = $1 AND patient_id = $2 AND status = $3',
      [bookingId, req.user.id, 'assigned']
    )

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ message: 'Booking not found or not ready for payment' })
    }

    const booking = bookingResult.rows[0]

    // Update booking status to paid
    await pool.query(
      'UPDATE bookings SET status = $1 WHERE id = $2',
      ['paid', bookingId]
    )

    // Update payment record with actual booking price
    await pool.query(
      `UPDATE payments SET status = $1, payment_date = CURRENT_TIMESTAMP 
       WHERE booking_id = $2`,
      ['paid', bookingId]
    )

    // Notify admin and provider
    await pool.query(
      `INSERT INTO notifications (user_id, message, type) 
       SELECT id, $1, 'payment_received' FROM users WHERE role = 'admin'`,
      [`Payment of UGX ${parseFloat(booking.price).toLocaleString()} received for booking #${bookingId}`]
    )

    if (booking.assigned_provider_id) {
      await pool.query(
        'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)',
        [booking.assigned_provider_id, `Payment of UGX ${parseFloat(booking.price).toLocaleString()} confirmed for your assigned service`, 'payment_received']
      )
    }

    res.json({ message: 'Payment marked as paid successfully' })
  } catch (error) {
    console.error('Payment error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get payment history (for admin)
router.get('/history', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, b.service_type, u.name as patient_name
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       JOIN users u ON b.patient_id = u.id
       ORDER BY p.created_at DESC`
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching payment history:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router