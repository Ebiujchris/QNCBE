const pool = require('./config/database')

async function quickFix() {
  try {
    console.log('🔧 Running quick database fix...')
    
    // Add price column
    await pool.query(`
      ALTER TABLE bookings 
      ADD COLUMN IF NOT EXISTS price DECIMAL(10,2) DEFAULT 0.00
    `)
    console.log('✅ Added price column')
    
    // Add phone_number column
    await pool.query(`
      ALTER TABLE bookings 
      ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20) DEFAULT ''
    `)
    console.log('✅ Added phone_number column')
    
    // Update existing bookings with default price
    await pool.query(`
      UPDATE bookings 
      SET price = 50000.00 
      WHERE status IN ('assigned', 'paid', 'completed') 
      AND (price IS NULL OR price = 0.00)
    `)
    console.log('✅ Updated existing bookings with default prices')
    
    console.log('🎉 Database fix completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Fix failed:', error)
    process.exit(1)
  }
}

quickFix()