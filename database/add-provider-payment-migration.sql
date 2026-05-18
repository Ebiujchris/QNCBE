-- Add provider_payment column to bookings table
-- This separates what the client pays from what the provider receives

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS provider_payment DECIMAL(10,2) DEFAULT 0.00;

-- Add comment to explain the column
COMMENT ON COLUMN bookings.provider_payment IS 'Amount to be paid to the provider (may differ from client price)';
