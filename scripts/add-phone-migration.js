const pool = require('../config/database')
const fs = require('fs')
const path = require('path')

async function runMigration() {
  try {
    console.log('Running phone number migration...')
    
    // Read the migration SQL file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../database/add-phone-migration.sql'), 
      'utf8'
    )
    
    // Execute the migration
    await pool.query(migrationSQL)
    
    console.log('✅ Phone number migration completed successfully!')
    console.log('- Added phone column to users table')
    console.log('- Created index for phone numbers')
    
  } catch (error) {
    if (error.message.includes('column "phone" of relation "users" already exists')) {
      console.log('ℹ️  Phone column already exists, skipping migration.')
    } else {
      console.error('❌ Migration failed:', error.message)
      throw error
    }
  } finally {
    await pool.end()
  }
}

// Run the migration
runMigration().catch(console.error)