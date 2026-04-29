const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function fixDatabase() {
  const client = await pool.connect()
  try {
    console.log('🔗 Connected to Neon database...')

    // Create tables only if they don't exist (safe to run multiple times)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('patient', 'provider', 'admin')),
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ users table OK')

    await client.query(`
      CREATE TABLE IF NOT EXISTS providers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        provider_type VARCHAR(50) NOT NULL CHECK (provider_type IN ('nurse', 'doctor', 'caregiver')),
        availability TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ providers table OK')

    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        service_type VARCHAR(50) NOT NULL CHECK (service_type IN ('nursing', 'doctor', 'caregiver')),
        description TEXT NOT NULL,
        location VARCHAR(500) NOT NULL,
        phone_number VARCHAR(20) NOT NULL,
        preferred_date DATE NOT NULL,
        urgency VARCHAR(20) DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent', 'emergency')),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'paid', 'completed', 'cancelled')),
        assigned_provider_id INTEGER REFERENCES users(id),
        price DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ bookings table OK')

    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid')),
        payment_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ payments table OK')

    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'general',
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ notifications table OK')

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        requested_by VARCHAR(255) NOT NULL,
        request_reason TEXT,
        type VARCHAR(50) DEFAULT 'admin_request' CHECK (type IN ('admin_request', 'provider_approval')),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        approved_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ admin_requests table OK')

    // Add phone column to users if missing
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)
    `).catch(() => {}) // ignore if already exists

    // Add type column to admin_requests if missing
    await client.query(`
      ALTER TABLE admin_requests ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'admin_request'
    `).catch(() => {})

    // Create indexes (safe - IF NOT EXISTS)
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_bookings_patient_id ON bookings(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_bookings_provider_id ON bookings(assigned_provider_id)`,
      `CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)`,
      `CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_providers_user_id ON providers(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_admin_requests_status ON admin_requests(status)`,
    ]
    for (const idx of indexes) {
      await client.query(idx).catch(() => {})
    }
    console.log('✅ Indexes OK')

    console.log('\n🎉 Database is fully set up and ready!')
    console.log('All tables exist. You can now start the server.')

  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    client.release()
    await pool.end()
  }
}

fixDatabase()
