const pool = require('../config/database')
const fs = require('fs')
const path = require('path')

async function runMigration() {
  try {
    console.log('Running provider approval migration...')
    
    // Read the migration SQL file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../database/add-provider-approval-migration.sql'), 
      'utf8'
    )
    
    // Execute the migration
    await pool.query(migrationSQL)
    
    console.log('✅ Provider approval migration completed successfully!')
    console.log('- Added type column to admin_requests table')
    console.log('- Updated existing records with default type')
    
  } catch (error) {
    if (error.message.includes('column "type" of relation "admin_requests" already exists')) {
      console.log('ℹ️  Type column already exists, skipping migration.')
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