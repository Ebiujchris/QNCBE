const { Pool } = require('pg')
require('dotenv').config()
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function migrate() {
  try {
    await pool.query(`ALTER TABLE providers ADD COLUMN IF NOT EXISTS doc_license_url TEXT`)
    await pool.query(`ALTER TABLE providers ADD COLUMN IF NOT EXISTS doc_certificate_url TEXT`)
    await pool.query(`ALTER TABLE providers ADD COLUMN IF NOT EXISTS doc_cv_url TEXT`)
    console.log('✅ Added document URL columns to providers table')
  } catch (err) {
    console.error('ERROR:', err.message)
  } finally {
    await pool.end()
  }
}
migrate()
