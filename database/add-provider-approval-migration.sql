-- Add type column to admin_requests table to distinguish request types
ALTER TABLE admin_requests ADD COLUMN type VARCHAR(50) DEFAULT 'admin_request' CHECK (type IN ('admin_request', 'provider_approval'));

-- Update existing records to have the default type
UPDATE admin_requests SET type = 'admin_request' WHERE type IS NULL;