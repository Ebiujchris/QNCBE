const { Pool } = require('pg')
require('dotenv').config()
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function migrate() {
  try {
    await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS days INTEGER DEFAULT 1`)
    await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rate_per_day DECIMAL(10,2) DEFAULT 0`)
    console.log('✅ Added days and rate_per_day columns to bookings')

    // Check columns
    const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='bookings' ORDER BY ordinal_position`)
    console.log('bookings columns:', r.rows.map(x => x.column_name).join(', '))
  } catch (err) {
    console.error('ERROR:', err.message)
  } finally {
    await pool.end()
  }
}
migrate()
