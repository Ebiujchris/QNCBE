require('dotenv').config();
const pool = require('./config/database');
pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='bookings' ORDER BY ordinal_position")
  .then(r => {
    console.log('✅ Bookings table columns:');
    r.rows.forEach(row => console.log('  -', row.column_name));
    process.exit(0);
  })
  .catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
  });
