const bcrypt = require('bcryptjs')
const { Pool } = require('pg')
require('dotenv').config()

async function createAdminUser() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    console.log('🔐 Creating admin user...')
    
    // Hash the password properly
    const hashedPassword = await bcrypt.hash('admin123', 10)
    console.log('Generated password hash:', hashedPassword)
    
    // Check if admin already exists
    const existingAdmin = await pool.query('SELECT * FROM users WHERE email = $1', ['admin@qnc.com'])
    
    if (existingAdmin.rows.length > 0) {
      console.log('📝 Admin user already exists, updating password...')
      await pool.query(
        'UPDATE users SET password = $1 WHERE email = $2',
        [hashedPassword, 'admin@qnc.com']
      )
      console.log('✅ Admin password updated successfully!')
    } else {
      console.log('👤 Creating new admin user...')
      await pool.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
        ['Admin User', 'admin@qnc.com', hashedPassword, 'admin']
      )
      console.log('✅ Admin user created successfully!')
    }
    
    // Verify the admin user
    const adminUser = await pool.query('SELECT id, name, email, role FROM users WHERE email = $1', ['admin@qnc.com'])
    console.log('🔍 Admin user details:', adminUser.rows[0])
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error)
  } finally {
    await pool.end()
  }
}

createAdminUser()