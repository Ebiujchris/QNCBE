const express = require('express')
const cors = require('cors')
require('dotenv').config()

const authRoutes = require('./routes/auth')
const bookingRoutes = require('./routes/bookings')
const paymentRoutes = require('./routes/payments')
const notificationRoutes = require('./routes/notifications')
const adminRoutes = require('./routes/admin')
const contactRoutes = require('./routes/contact')

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/bookings', bookingRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/contact', contactRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'QNC Booking API is running!' })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})