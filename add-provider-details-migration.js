const { Pool } = require('pg')
require('dotenv').config()
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function migrate() {
  try {
    await pool.query(`ALTER TABLE providers ADD COLUMN IF NOT EXISTS experience VARCHAR(50)`)
    await pool.query(`ALTER TABLE providers ADD COLUMN IF NOT EXISTS qualifications TEXT`)
    await pool.query(`ALTER TABLE providers ADD COLUMN IF NOT EXISTS license_number VARCHAR(100)`)
    await pool.query(`ALTER TABLE providers ADD COLUMN IF NOT EXISTS bio TEXT`)
    await pool.query(`ALTER TABLE providers ADD COLUMN IF NOT EXISTS location VARCHAR(255)`)
    console.log('✅ Added provider detail columns')

    const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='providers' ORDER BY ordinal_position`)
    console.log('providers columns:', r.rows.map(x => x.column_name).join(', '))
  } catch (err) {
    console.error('ERROR:', err.message)
  } finally {
    await pool.end()
  }
}
migrate()
