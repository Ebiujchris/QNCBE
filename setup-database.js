const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')
require('dotenv').config()

async function setupDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    console.log('🔗 Connecting to Neon database...')
    
    // Read and execute schema
    const schemaPath = path.join(__dirname, 'database', 'schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')
    
    console.log('📊 Creating database schema...')
    await pool.query(schema)
    
    console.log('✅ Database setup completed successfully!')
    console.log('🔑 Default admin login: admin@qnc.com / admin123')
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message)
    
    // If tables already exist, that's okay
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Tables already exist, skipping creation')
    }
  } finally {
    await pool.end()
  }
}

setupDatabase()