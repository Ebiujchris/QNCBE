const { Pool } = require('pg')
require('dotenv').config()

async function testConnection() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  })

  try {
    console.log('🔄 Testing database connection...')
    console.log('Database URL:', process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':****@'))
    
    const client = await pool.connect()
    console.log('✅ Successfully connected to database!')
    
    // Test a simple query
    const result = await client.query('SELECT NOW()')
    console.log('✅ Database query successful:', result.rows[0])
    
    client.release()
    await pool.end()
    
  } catch (error) {
    console.error('❌ Database connection failed:')
    console.error('Error code:', error.code)
    console.error('Error message:', error.message)
    
    if (error.code === 'ENOTFOUND') {
      console.log('\n💡 Possible solutions:')
      console.log('1. Check your internet connection')
      console.log('2. Verify the database URL is correct')
      console.log('3. Check if the Neon database is active')
      console.log('4. Try using a local database for development')
    }
  }
}

testConnection()