const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const pool = require('../config/database')

const router = express.Router()

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
      await pool.query(
        'INSERT INTO providers (user_id, provider_type) VALUES ($1, $2)',
        [user.id, providerType]
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

    // Get user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' })
    }

    const user = result.rows[0]

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
    if (!isMatch) {
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

module.exports = router