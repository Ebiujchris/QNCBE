const express = require('express')
const nodemailer = require('nodemailer')
const pool = require('../config/database')
const { authenticateToken, requireRole } = require('../middleware/auth')

const router = express.Router()

// Mark payment as paid (patients only)
router.post('/:bookingId/mark-paid', authenticateToken, requireRole(['patient', 'admin']), async (req, res) => {
  try {
    const bookingId = req.params.bookingId
    const isAdmin = req.user.role === 'admin'

    // Build query based on role
    const bookingResult = await pool.query(
      isAdmin
        ? 'SELECT * FROM bookings WHERE id = $1 AND status = $2'
        : 'SELECT * FROM bookings WHERE id = $1 AND patient_id = $2 AND status = $3',
      isAdmin ? [bookingId, 'assigned'] : [bookingId, req.user.id, 'assigned']
    )

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ message: 'Booking not found or not ready for payment' })
    }

    const booking = bookingResult.rows[0]

    await pool.query('UPDATE bookings SET status = $1 WHERE id = $2', ['paid', bookingId])

    await pool.query(
      `UPDATE payments SET status = $1, payment_date = CURRENT_TIMESTAMP WHERE booking_id = $2`,
      ['paid', bookingId]
    )

    // Notify patient
    await pool.query(
      'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)',
      [booking.patient_id,
       `Your payment of UGX ${parseFloat(booking.price).toLocaleString()} for booking #${bookingId} has been confirmed.`,
       'payment_received']
    )

    // Notify provider
    if (booking.assigned_provider_id) {
      await pool.query(
        'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)',
        [booking.assigned_provider_id,
         `Payment of UGX ${parseFloat(booking.price).toLocaleString()} confirmed for your assigned service (Booking #${bookingId}).`,
         'payment_received']
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
      `SELECT p.*, b.service_type, b.days, b.rate_per_day, b.location, b.preferred_date,
              u.name as patient_name, u.email as patient_email, u.phone as patient_phone,
              pu.name as provider_name
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       JOIN users u ON b.patient_id = u.id
       LEFT JOIN users pu ON b.assigned_provider_id = pu.id
       ORDER BY p.created_at DESC`
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching payment history:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get unpaid assigned bookings (for reminders)
router.get('/unpaid', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.id, b.service_type, b.price, b.days, b.rate_per_day, b.preferred_date,
              u.id as patient_id, u.name as patient_name, u.email as patient_email,
              pu.name as provider_name
       FROM bookings b
       JOIN users u ON b.patient_id = u.id
       LEFT JOIN users pu ON b.assigned_provider_id = pu.id
       WHERE b.status = 'assigned' AND b.price > 0
       ORDER BY b.created_at ASC`
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching unpaid bookings:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Send payment reminder email to a patient
router.post('/send-reminder/:bookingId', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { bookingId } = req.params
    const result = await pool.query(
      `SELECT b.*, u.name as patient_name, u.email as patient_email,
              pu.name as provider_name
       FROM bookings b
       JOIN users u ON b.patient_id = u.id
       LEFT JOIN users pu ON b.assigned_provider_id = pu.id
       WHERE b.id = $1 AND b.status = 'assigned'`,
      [bookingId]
    )
    if (result.rows.length === 0) return res.status(404).json({ message: 'Booking not found or already paid' })

    const b = result.rows[0]
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    })

    await transporter.sendMail({
      from: `"QNC Solutions" <${process.env.EMAIL_USER}>`,
      to: b.patient_email,
      subject: `Payment Reminder — QNC Solutions Booking #${b.id}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:linear-gradient(135deg,#1e40af,#7c2d12);padding:32px;text-align:center;border-radius:12px 12px 0 0;">
            <h1 style="color:white;margin:0;font-size:1.6rem;">QNC Solutions</h1>
            <p style="color:rgba(255,255,255,0.9);margin:6px 0 0;">Payment Reminder</p>
          </div>
          <div style="background:#f8fafc;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;">
            <p style="color:#374151;">Dear <strong>${b.patient_name}</strong>,</p>
            <p style="color:#6b7280;">This is a friendly reminder that payment is outstanding for your healthcare service booking.</p>
            <div style="background:white;border-radius:8px;padding:20px;margin:20px 0;border:1px solid #e5e7eb;">
              <h3 style="color:#1f2937;margin:0 0 12px;">Booking Details</h3>
              <table style="width:100%;font-size:0.9rem;">
                <tr><td style="color:#6b7280;padding:4px 0;">Booking #</td><td style="font-weight:600;">${b.id}</td></tr>
                <tr><td style="color:#6b7280;padding:4px 0;">Service</td><td style="font-weight:600;text-transform:capitalize;">${b.service_type}</td></tr>
                <tr><td style="color:#6b7280;padding:4px 0;">Provider</td><td style="font-weight:600;">${b.provider_name || 'Assigned'}</td></tr>
                ${b.rate_per_day && b.days ? `<tr><td style="color:#6b7280;padding:4px 0;">Rate</td><td>UGX ${parseFloat(b.rate_per_day).toLocaleString()}/day × ${b.days} day(s)</td></tr>` : ''}
                <tr><td style="color:#6b7280;padding:4px 0;">Amount Due</td><td style="font-weight:700;color:#dc2626;font-size:1.1rem;">UGX ${parseFloat(b.price).toLocaleString()}</td></tr>
              </table>
            </div>
            <p style="color:#6b7280;font-size:0.9rem;">Please log in to your QNC Solutions account to complete your payment.</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
            <p style="color:#9ca3af;font-size:0.8rem;text-align:center;">QNC Solutions &bull; qncsolutions3@gmail.com &bull; +256-791-785931</p>
          </div>
        </div>`
    })

    // Also create in-app notification
    await pool.query(
      'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)',
      [b.patient_id, `Payment reminder: UGX ${parseFloat(b.price).toLocaleString()} is due for your ${b.service_type} service (Booking #${b.id}).`, 'payment_reminder']
    )

    res.json({ message: `Reminder sent to ${b.patient_email}` })
  } catch (error) {
    console.error('Reminder error:', error)
    res.status(500).json({ message: 'Failed to send reminder' })
  }
})

// Generate invoice for a booking
router.get('/invoice/:bookingId', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { bookingId } = req.params
    const result = await pool.query(
      `SELECT b.*, u.name as patient_name, u.email as patient_email, u.phone as patient_phone,
              pu.name as provider_name, p.payment_date, p.status as payment_status
       FROM bookings b
       JOIN users u ON b.patient_id = u.id
       LEFT JOIN users pu ON b.assigned_provider_id = pu.id
       LEFT JOIN payments p ON b.id = p.booking_id
       WHERE b.id = $1`,
      [bookingId]
    )
    if (result.rows.length === 0) return res.status(404).json({ message: 'Booking not found' })
    res.json(result.rows[0])
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router