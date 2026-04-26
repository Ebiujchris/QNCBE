const pool = require('./config/database')

async function fixPhoneColumn() {
  try {
    console.log('🔧 Checking and fixing phone column...')
    
    // Check if phone column exists
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'phone'
    `)
    
    if (columnCheck.rows.length === 0) {
      console.log('📱 Adding phone column to users table...')
      
      // Add phone column
      await pool.query('ALTER TABLE users ADD COLUMN phone VARCHAR(20)')
      
      // Create index
      await pool.query('CREATE INDEX idx_users_phone ON users(phone)')
      
      console.log('✅ Phone column added successfully!')
    } else {
      console.log('ℹ️  Phone column already exists')
    }
    
    // Check if type column exists in admin_requests
    const typeColumnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'admin_requests' AND column_name = 'type'
    `)
    
    if (typeColumnCheck.rows.length === 0) {
      console.log('🔧 Adding type column to admin_requests table...')
      
      // Add type column
      await pool.query(`
        ALTER TABLE admin_requests 
        ADD COLUMN type VARCHAR(50) DEFAULT 'admin_request' 
        CHECK (type IN ('admin_request', 'provider_approval'))
      `)
      
      // Update existing records
      await pool.query(`UPDATE admin_requests SET type = 'admin_request' WHERE type IS NULL`)
      
      console.log('✅ Type column added successfully!')
    } else {
      console.log('ℹ️  Type column already exists')
    }
    
    console.log('🎉 Database migration completed successfully!')
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    throw error
  } finally {
    await pool.end()
  }
}

// Run the migration
fixPhoneColumn().catch(console.error)