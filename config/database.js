const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Force SSL for Neon
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10,
  // Add retry logic
  retryDelayMs: 1000,
  maxRetries: 3
})

// Test connection with better error handling
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message)
    if (err.code === 'ENOTFOUND') {
      console.log('💡 Possible solutions:')
      console.log('1. Check internet connection')
      console.log('2. Wake up Neon database if sleeping')
      console.log('3. Verify DATABASE_URL is correct')
    }
  } else {
    console.log('✅ Connected to Neon PostgreSQL database')
    release()
  }
})

// Handle pool errors
pool.on('error', (err) => {
  console.error('❌ Database pool error:', err.message)
})

module.exports = pool