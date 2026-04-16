const express = require('express')
const nodemailer = require('nodemailer')
const pool = require('../config/database')

const router = express.Router()

// Create transporter for sending emails
const createTransporter = () => {
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'qncsolutions3@gmail.com',
      pass: process.env.EMAIL_PASS || 'your-app-password' // Use app password for Gmail
    }
  })
}

// Handle contact form submission
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: 'Please fill in all required fields' })
    }

    // Save to database (optional - for record keeping)
    try {
      await pool.query(
        `INSERT INTO contact_messages (name, email, phone, subject, message, created_at) 
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [name, email, phone || null, subject, message]
      )
    } catch (dbError) {
      console.log('Database save failed (table might not exist):', dbError.message)
      // Continue even if database save fails
    }

    // Send email notification
    try {
      const transporter = createTransporter()

      // Email to QNC Solutions
      const adminMailOptions = {
        from: process.env.EMAIL_USER || 'qncsolutions3@gmail.com',
        to: 'qncsolutions3@gmail.com',
        subject: `New Contact Form Submission: ${subject}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Message:</strong></p>
          <p>${message.replace(/\n/g, '<br>')}</p>
          <hr>
          <p><em>Sent from QNC Solutions Contact Form</em></p>
        `
      }

      // Auto-reply to user
      const userMailOptions = {
        from: process.env.EMAIL_USER || 'qncsolutions3@gmail.com',
        to: email,
        subject: 'Thank you for contacting QNC Solutions',
        html: `
          <h2>Thank you for contacting QNC Solutions</h2>
          <p>Dear ${name},</p>
          <p>We have received your message and will get back to you within 24 hours.</p>
          <p><strong>Your message:</strong></p>
          <p>${message.replace(/\n/g, '<br>')}</p>
          <hr>
          <p>Best regards,<br>
          QNC Solutions Team<br>
          Phone: +256-791-785931<br>
          Email: qncsolutions3@gmail.com</p>
        `
      }

      // Send both emails
      await Promise.all([
        transporter.sendMail(adminMailOptions),
        transporter.sendMail(userMailOptions)
      ])

      res.json({ 
        message: 'Message sent successfully! We will get back to you within 24 hours.',
        success: true 
      })

    } catch (emailError) {
      console.error('Email sending failed:', emailError)
      // Still return success since the message was received
      res.json({ 
        message: 'Message received! We will get back to you within 24 hours.',
        success: true 
      })
    }

  } catch (error) {
    console.error('Contact form error:', error)
    res.status(500).json({ message: 'Failed to send message. Please try again.' })
  }
})

module.exports = router