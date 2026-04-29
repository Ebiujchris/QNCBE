const { Pool } = require('pg')
require('dotenv').config()
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function check() {
  try {
    const r = await pool.query('SELECT id, name, email, role, status FROM users ORDER BY created_at DESC')
    console.log('\nAll users in database:')
    console.table(r.rows)
  } catch (err) {
    console.error('ERROR:', err.message)
  } finally {
    await pool.end()
  }
}
check()
