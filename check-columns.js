const { Pool } = require('pg')
require('dotenv').config()
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function check() {
  try {
    const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position")
    console.log('users columns:', r.rows.map(x => x.column_name).join(', '))

    const r2 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='providers' ORDER BY ordinal_position")
    console.log('providers columns:', r2.rows.map(x => x.column_name).join(', '))

    // Try the exact failing query
    const r3 = await pool.query(`
      SELECT ar.*, u.name, u.email, u.phone, u.location, u.created_at as user_created_at,
             p.provider_type, p.availability
      FROM admin_requests ar
      JOIN users u ON ar.user_id = u.id
      JOIN providers p ON u.id = p.user_id
      WHERE ar.status = 'pending' AND ar.type = 'provider_approval'
      ORDER BY ar.created_at ASC
    `)
    console.log('provider-requests query OK, rows:', r3.rows.length)
  } catch (err) {
    console.error('ERROR:', err.message)
  } finally {
    await pool.end()
  }
}
check()
