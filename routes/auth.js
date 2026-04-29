const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const nodemailer = require('nodemailer')
const pool = require('../config/database')
const { upload } = require('../middleware/upload')

const router = express.Router()

const createTransporter = () => nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'qncsolutions3@gmail.com',
    pass: process.env.EMAIL_PASS
  }
})

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, role, providerType, requestReason } = req.body

    // Check if user exists
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' })
    }

    // Format phone number with +256 prefix if not already present
    let formattedPhone = phone
    if (phone && !phone.startsWith('+256')) {
      // Remove any leading zeros or spaces
      const cleanPhone = phone.replace(/^0+/, '').replace(/\s+/g, '')
      formattedPhone = `+256${cleanPhone}`
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Handle admin registration
    if (role === 'admin') {
      // Check if there are any existing admins
      const existingAdmins = await pool.query('SELECT COUNT(*) FROM users WHERE role = $1 AND status = $2', ['admin', 'active'])
      const adminCount = parseInt(existingAdmins.rows[0].count)

      if (adminCount === 0) {
        // First admin - auto-approve
        try {
          const result = await pool.query(
            'INSERT INTO users (name, email, phone, password, role, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, phone, role, status',
            [name, email, formattedPhone, hashedPassword, role, 'active']
          )
          return res.status(201).json({ 
            message: 'First admin account created successfully', 
            user: result.rows[0] 
          })
        } catch (phoneError) {
          if (phoneError.message.includes('column "phone"')) {
            const result = await pool.query(
              'INSERT INTO users (name, email, password, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, status',
              [name, email, hashedPassword, role, 'active']
            )
            return res.status(201).json({ 
              message: 'First admin account created successfully', 
              user: result.rows[0] 
            })
          } else {
            throw phoneError
          }
        }
      } else {
        // Subsequent admins - require approval
        try {
          const result = await pool.query(
            'INSERT INTO users (name, email, phone, password, role, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, phone, role, status',
            [name, email, formattedPhone, hashedPassword, role, 'pending']
          )
          var user = result.rows[0]
        } catch (phoneError) {
          if (phoneError.message.includes('column "phone"')) {
            const result = await pool.query(
              'INSERT INTO users (name, email, password, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, status',
              [name, email, hashedPassword, role, 'pending']
            )
            var user = result.rows[0]
          } else {
            throw phoneError
          }
        }

        // Create admin request
        await pool.query(
          'INSERT INTO admin_requests (user_id, requested_by, request_reason) VALUES ($1, $2, $3)',
          [user.id, name, requestReason || 'Admin access request']
        )

        // Notify existing admins
        await pool.query(
          `INSERT INTO notifications (user_id, message, type) 
           SELECT id, $1, 'admin_request' FROM users WHERE role = 'admin' AND status = 'active'`,
          [`New admin access request from ${name} (${email}). Please review and approve.`]
        )

        return res.status(201).json({ 
          message: 'Admin registration submitted for approval. You will be notified once approved.',
          user: { ...user, needsApproval: true }
        })
      }
    }

    // Regular user registration (patient/provider)
    let userStatus = 'active'
    
    // Providers need admin approval
    if (role === 'provider') {
      userStatus = 'pending'
    }

    try {
      // Try with phone column first
      const result = await pool.query(
        'INSERT INTO users (name, email, phone, password, role, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, phone, role, status',
        [name, email, formattedPhone, hashedPassword, role, userStatus]
      )
      var user = result.rows[0]
    } catch (phoneError) {
      // If phone column doesn't exist, try without it
      if (phoneError.message.includes('column "phone"')) {
        console.log('Phone column not found, inserting without phone')
        const result = await pool.query(
          'INSERT INTO users (name, email, password, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, status',
          [name, email, hashedPassword, role, userStatus]
        )
        var user = result.rows[0]
      } else {
        throw phoneError
      }
    }

    // If provider, insert provider details and create approval request
    if (role === 'provider' && providerType) {
      const { experience, qualifications, licenseNumber, availability, bio, location } = req.body
      await pool.query(
        `INSERT INTO providers (user_id, provider_type, availability, experience, qualifications, license_number, bio, location)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [user.id, providerType, availability || null, experience || null, qualifications || null, licenseNumber || null, bio || null, location || null]
      )

      // Create provider approval request
      await pool.query(
        'INSERT INTO admin_requests (user_id, requested_by, request_reason, type) VALUES ($1, $2, $3, $4)',
        [user.id, name, `Provider registration: ${providerType}`, 'provider_approval']
      )

      // Notify existing admins about new provider registration
      await pool.query(
        `INSERT INTO notifications (user_id, message, type) 
         SELECT id, $1, 'provider_request' FROM users WHERE role = 'admin' AND status = 'active'`,
        [`New provider registration from ${name} (${providerType}). Please review and approve.`]
      )

      return res.status(201).json({ 
        message: 'Provider application submitted successfully! Your application is pending admin approval. You will be notified once approved.',
        user: { ...user, needsApproval: true }
      })
    }

    res.status(201).json({ message: 'User registered successfully', user })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    
    // Debug logging
    console.log('Login attempt:', { email, passwordLength: password?.length })

    // Get user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    console.log('User found:', result.rows.length > 0 ? 'Yes' : 'No')
    
    if (result.rows.length === 0) {
      console.log('Login failed: User not found')
      return res.status(400).json({ message: 'Invalid credentials' })
    }

    const user = result.rows[0]
    console.log('User status:', user.status)

    // Check if user is pending approval
    if (user.status === 'pending') {
      return res.status(403).json({ 
        message: 'Your account is pending approval. Please wait for admin approval.',
        needsApproval: true 
      })
    }

    // Check if user is suspended
    if (user.status === 'suspended') {
      return res.status(403).json({ message: 'Your account has been suspended. Contact support.' })
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password)
    console.log('Password match:', isMatch)
    
    if (!isMatch) {
      console.log('Login failed: Invalid password')
      return res.status(400).json({ message: 'Invalid credentials' })
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    )

    // Remove password from response
    delete user.password

    res.json({ user, token })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Provider registration with document uploads
router.post('/register-provider',
  upload.fields([
    { name: 'license', maxCount: 1 },
    { name: 'certificate', maxCount: 1 },
    { name: 'cv', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { name, email, phone, password, providerType, experience, qualifications, licenseNumber, availability, bio, location } = req.body

      if (!name || !email || !password || !providerType) {
        return res.status(400).json({ message: 'Name, email, password and provider type are required' })
      }

      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' })
      }

      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email])
      if (existing.rows.length > 0) {
        return res.status(400).json({ message: 'User already exists with this email' })
      }

      // Format phone
      let formattedPhone = phone
      if (phone && !phone.startsWith('+256')) {
        formattedPhone = `+256${phone.replace(/^0+/, '').replace(/\s+/g, '')}`
      }

      const hashedPassword = await bcrypt.hash(password, 10)

      // Insert user
      const userResult = await pool.query(
        'INSERT INTO users (name, email, phone, password, role, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, email, role, status',
        [name, email, formattedPhone, hashedPassword, 'provider', 'pending']
      )
      const user = userResult.rows[0]

      // Get uploaded file URLs
      const licenseUrl = req.files?.license?.[0]?.path || null
      const certificateUrl = req.files?.certificate?.[0]?.path || null
      const cvUrl = req.files?.cv?.[0]?.path || null

      // Insert provider details
      await pool.query(
        `INSERT INTO providers (user_id, provider_type, availability, experience, qualifications, license_number, bio, location, doc_license_url, doc_certificate_url, doc_cv_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [user.id, providerType, availability || null, experience || null, qualifications || null,
         licenseNumber || null, bio || null, location || null, licenseUrl, certificateUrl, cvUrl]
      )

      // Create approval request
      await pool.query(
        'INSERT INTO admin_requests (user_id, requested_by, request_reason, type) VALUES ($1,$2,$3,$4)',
        [user.id, name, `Provider registration: ${providerType}`, 'provider_approval']
      )

      // Notify admins
      await pool.query(
        `INSERT INTO notifications (user_id, message, type)
         SELECT id, $1, 'provider_request' FROM users WHERE role='admin' AND status='active'`,
        [`New provider application from ${name} (${providerType}). Documents uploaded.`]
      )

      res.status(201).json({
        message: 'Provider application submitted successfully! Your application is pending admin approval.',
        user: { ...user, needsApproval: true }
      })
    } catch (error) {
      console.error('Provider registration error:', error)
      res.status(500).json({ message: error.message || 'Server error' })
    }
  }
)

// Forgot password — send reset email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ message: 'Email is required' })

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    if (result.rows.length === 0) {
      // Don't reveal whether email exists
      return res.json({ message: 'If that email exists, a reset link has been sent.' })
    }

    const user = result.rows[0]

    // Only allow patient and provider
    if (!['patient', 'provider'].includes(user.role)) {
      return res.status(403).json({ message: 'Password reset is not available for this account type.' })
    }

    // Generate a secure token valid for 1 hour
    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Store token in DB
    await pool.query(
      `UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3`,
      [token, expires, user.id]
    ).catch(async () => {
      // Columns may not exist yet — add them
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255)`)
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP`)
      await pool.query(
        `UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3`,
        [token, expires, user.id]
      )
    })

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`

    const transporter = createTransporter()
    await transporter.sendMail({
      from: `"QNC Solutions" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Reset Your QNC Solutions Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1e40af, #7c2d12); padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 1.8rem;">QNC Solutions</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">Password Reset Request</p>
          </div>
          <div style="background: #f8fafc; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
            <p style="color: #374151; font-size: 1rem;">Hi <strong>${user.name}</strong>,</p>
            <p style="color: #6b7280;">We received a request to reset your password. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}" style="background: linear-gradient(135deg, #1e40af, #7c2d12); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 1rem;">
                Reset My Password
              </a>
            </div>
            <p style="color: #9ca3af; font-size: 0.85rem;">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            <p style="color: #9ca3af; font-size: 0.8rem; text-align: center;">QNC Solutions &bull; qncsolutions3@gmail.com</p>
          </div>
        </div>
      `
    })

    res.json({ message: 'If that email exists, a reset link has been sent.' })
  } catch (error) {
    console.error('Forgot password error:', error)
    res.status(500).json({ message: 'Failed to send reset email. Please try again.' })
  }
})

// Reset password — verify token and set new password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body
    if (!token || !password) return res.status(400).json({ message: 'Token and new password are required' })
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' })

    const result = await pool.query(
      `SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()`,
      [token]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Reset link is invalid or has expired.' })
    }

    const hashed = await bcrypt.hash(password, 10)
    await pool.query(
      `UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2`,
      [hashed, result.rows[0].id]
    )

    res.json({ message: 'Password reset successfully. You can now log in.' })
  } catch (error) {
    console.error('Reset password error:', error)
    res.status(500).json({ message: 'Server error. Please try again.' })
  }
})

module.exports = router