const pool = require('../config/database')
const fs = require('fs')
const path = require('path')

async function runMigration() {
  try {
    console.log('Starting provider payment migration...')
    
    const sql = fs.readFileSync(
      path.join(__dirname, '../database/add-provider-payment-migration.sql'),
      'utf8'
    )
    
    await pool.query(sql)
    
    console.log('✅ Provider payment column added successfully!')
    console.log('The bookings table now has a provider_payment column.')
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  }
}

runMigration()
