const { Pool } = require('pg')
const bcrypt = require('bcryptjs')
require('dotenv').config()
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

// ✏️  Set the new password here
const NEW_PASSWORD = 'qnc1234'

async function resetPasswords() {
  try {
    const hashed = await bcrypt.hash(NEW_PASSWORD, 10)

    // Reset all active patient and provider accounts
    const r = await pool.query(
      `UPDATE users SET password = $1 WHERE role IN ('patient', 'provider') AND status = 'active' RETURNING id, name, email, role`,
      [hashed]
    )

    console.log(`\n✅ Reset passwords for ${r.rows.length} accounts to: "${NEW_PASSWORD}"`)
    console.table(r.rows)
  } catch (err) {
    console.error('ERROR:', err.message)
  } finally {
    await pool.end()
  }
}

resetPasswords()
