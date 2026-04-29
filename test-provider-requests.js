const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function test() {
  try {
    // Test 1: check admin_requests table contents
    const r1 = await pool.query("SELECT COUNT(*) FROM admin_requests")
    console.log('admin_requests total rows:', r1.rows[0].count)

    // Test 2: check if type column exists
    const r2 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='admin_requests'")
    console.log('admin_requests columns:', r2.rows.map(r => r.column_name).join(', '))

    // Test 3: check providers table
    const r3 = await pool.query("SELECT COUNT(*) FROM providers")
    console.log('providers total rows:', r3.rows[0].count)

    // Test 4: run the actual query
    const r4 = await pool.query(`
      SELECT ar.*, u.name, u.email, u.created_at as user_created_at,
             p.provider_type, p.availability
      FROM admin_requests ar
      JOIN users u ON ar.user_id = u.id
      JOIN providers p ON u.id = p.user_id
      WHERE ar.status = 'pending' AND ar.type = 'provider_approval'
      ORDER BY ar.created_at ASC
    `)
    console.log('provider-requests query OK, rows:', r4.rows.length)

    // Test 5: admin-requests query
    const r5 = await pool.query(`
      SELECT ar.*, u.name, u.email, u.created_at as user_created_at
      FROM admin_requests ar
      JOIN users u ON ar.user_id = u.id
      WHERE ar.status = 'pending' AND ar.type = 'admin_request'
      ORDER BY ar.created_at ASC
    `)
    console.log('admin-requests query OK, rows:', r5.rows.length)

  } catch (err) {
    console.error('QUERY ERROR:', err.message)
  } finally {
    await pool.end()
  }
}

test()
