-- Add phone column to users table
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- Create index for phone numbers
CREATE INDEX idx_users_phone ON users(phone);