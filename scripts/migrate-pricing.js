const fs = require('fs')
const path = require('path')
const pool = require('../config/database')

async function runPricingMigration() {
  try {
    console.log('🚀 Starting pricing and phone number migration...')
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../database/add-pricing-migration.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    // Execute the migration
    await pool.query(migrationSQL)
    
    console.log('✅ Migration completed successfully!')
    console.log('📊 The following changes were made:')
    console.log('   - Added price column to bookings table')
    console.log('   - Added phone_number column to bookings table')
    console.log('   - Created performance indexes')
    console.log('   - Updated existing bookings with default prices')
    console.log('   - Created payment records for existing bookings')
    
    // Verify the migration
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_bookings,
        COUNT(CASE WHEN price > 0 THEN 1 END) as bookings_with_price,
        COUNT(CASE WHEN phone_number != '' THEN 1 END) as bookings_with_phone,
        SUM(price) as total_booking_value
      FROM bookings 
      WHERE status IN ('assigned', 'paid', 'completed')
    `)
    
    const stats = result.rows[0]
    console.log('\n📈 Migration Statistics:')
    console.log(`   - Total assigned/paid/completed bookings: ${stats.total_bookings}`)
    console.log(`   - Bookings with prices: ${stats.bookings_with_price}`)
    console.log(`   - Bookings with phone numbers: ${stats.bookings_with_phone}`)
    console.log(`   - Total booking value: UGX ${parseFloat(stats.total_booking_value || 0).toLocaleString()}`)
    
    console.log('\n⚠️  Note: Existing bookings without phone numbers will need to be updated manually.')
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

// Run the migration
runPricingMigration()