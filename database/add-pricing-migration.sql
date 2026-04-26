-- Migration script to add pricing support to existing QNC database
-- Run this script to update your existing database with pricing functionality

-- Add price column to bookings table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'bookings' AND column_name = 'price') THEN
        ALTER TABLE bookings ADD COLUMN price DECIMAL(10,2) DEFAULT 0.00;
    END IF;
END $$;

-- Add phone_number column to bookings table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'bookings' AND column_name = 'phone_number') THEN
        ALTER TABLE bookings ADD COLUMN phone_number VARCHAR(20) DEFAULT '';
    END IF;
END $$;

-- Update existing payments table to ensure proper constraints
ALTER TABLE payments ALTER COLUMN amount SET DEFAULT 0.00;

-- Create index for better performance on price queries
CREATE INDEX IF NOT EXISTS idx_bookings_price ON bookings(price);
CREATE INDEX IF NOT EXISTS idx_payments_amount ON payments(amount);
CREATE INDEX IF NOT EXISTS idx_payments_status_date ON payments(status, payment_date);

-- Update any existing assigned bookings without prices to have a default price
-- (You may want to set specific prices manually for existing bookings)
UPDATE bookings 
SET price = 50000.00 
WHERE status IN ('assigned', 'paid', 'completed') 
AND (price IS NULL OR price = 0.00);

-- Ensure all assigned bookings have corresponding payment records
INSERT INTO payments (booking_id, amount, status, payment_date)
SELECT b.id, b.price, 
       CASE 
         WHEN b.status = 'paid' OR b.status = 'completed' THEN 'paid'
         ELSE 'unpaid'
       END,
       CASE 
         WHEN b.status = 'paid' OR b.status = 'completed' THEN b.updated_at
         ELSE NULL
       END
FROM bookings b
WHERE b.status IN ('assigned', 'paid', 'completed')
AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = b.id);

COMMIT;