require('dotenv').config()
const pool = require('./config/database')

async function fixDatabase() {
  try {
    console.log('🔧 Fixing database schema...')
    console.log('📡 Connecting to Neon PostgreSQL...')
    
    // Check if price column exists
    const checkPrice = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'price'
    `)
    
    if (checkPrice.rows.length === 0) {
      console.log('Adding price column...')
      await pool.query(`ALTER TABLE bookings ADD COLUMN price DECIMAL(10,2) DEFAULT 0.00`)
      console.log('✅ Price column added')
    } else {
      console.log('✅ Price column already exists')
    }
    
    // Check if phone_number column exists
    const checkPhone = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'phone_number'
    `)
    
    if (checkPhone.rows.length === 0) {
      console.log('Adding phone_number column...')
      await pool.query(`ALTER TABLE bookings ADD COLUMN phone_number VARCHAR(20) DEFAULT ''`)
      console.log('✅ Phone number column added')
    } else {
      console.log('✅ Phone number column already exists')
    }
    
    // Update existing bookings with default price
    const updateResult = await pool.query(`
      UPDATE bookings 
      SET price = 50000.00 
      WHERE status IN ('assigned', 'paid', 'completed') 
      AND (price IS NULL OR price = 0.00)
      RETURNING id
    `)
    
    console.log(`✅ Updated ${updateResult.rows.length} existing bookings with default price`)
    
    // Verify the fix
    const verify = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bookings' 
      AND column_name IN ('price', 'phone_number')
      ORDER BY column_name
    `)
    
    console.log('\n📊 Database Schema Verification:')
    verify.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`)
    })
    
    console.log('\n🎉 Database fix completed successfully!')
    console.log('You can now restart your server and try assigning providers again.')
    
    await pool.end()
    process.exit(0)
  } catch (error) {
    console.error('❌ Database fix failed:', error.message)
    console.error('Full error:', error)
    await pool.end()
    process.exit(1)
  }
}

// Run the fix
fixDatabase()