const { Pool } = require('pg')
const bcrypt = require('bcryptjs')
require('dotenv').config()
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function testLogin(email, password) {
  try {
    const r = await pool.query('SELECT id, name, email, role, status, password FROM users WHERE email = $1', [email])
    if (r.rows.length === 0) {
      console.log(`❌ No user found with email: ${email}`)
      return
    }
    const user = r.rows[0]
    console.log(`✅ User found: ${user.name} | role: ${user.role} | status: ${user.status}`)
    const match = await bcrypt.compare(password, user.password)
    console.log(`🔑 Password "${password}" match: ${match ? '✅ CORRECT' : '❌ WRONG'}`)
  } catch (err) {
    console.error('ERROR:', err.message)
  }
}

async function run() {
  // Test the accounts that exist
  await testLogin('patient@test.com', 'test123')
  await testLogin('patient@test.com', 'password')
  await testLogin('patient@test.com', 'Test1234')
  await testLogin('bryankyom@gmail.com', 'test123')
  await testLogin('bryankyom@gmail.com', 'password')
  await pool.end()
}
run()
