# Provider Payment Feature Setup

## Overview
This feature allows admins to set separate payment amounts for providers that differ from what clients pay. This gives flexibility in pricing and commission management.

## What Changed

### Database
- Added `provider_payment` column to the `bookings` table
- This stores the amount the provider will receive (can be different from client price)

### Admin Dashboard (QNCADMIN)
- Assignment form now has a "Provider Payment" field
- Admin sees both:
  - **Client Total**: What the client pays (rate × days)
  - **Provider Payment**: What the provider receives (admin sets this)
- Success message shows both amounts for clarity

### Provider Dashboard (QNCFE)
- Providers now see their payment amount, not the client price
- Assignment cards show `provider_payment` as the price
- Earnings page shows `provider_payment` amounts
- Providers are notified with their payment amount

### Backend API
- `/admin/bookings/:id/assign` endpoint now accepts `providerPayment` parameter
- Provider notification message updated to show their payment amount
- `/bookings/my-assignments` returns `provider_payment` as `price` for providers
- `/bookings/provider/earnings` returns `provider_payment` as `amount`

## Setup Instructions

### 1. Run Database Migration

```bash
cd QNCBE
node scripts/add-provider-payment-migration.js
```

This will add the `provider_payment` column to your bookings table.

### 2. Verify Migration

Check your database to confirm the column was added:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bookings' AND column_name = 'provider_payment';
```

### 3. Update Existing Bookings (Optional)

If you have existing bookings, you may want to set their provider_payment to match the current price:

```sql
UPDATE bookings 
SET provider_payment = price 
WHERE provider_payment IS NULL OR provider_payment = 0;
```

## How It Works

### Admin Workflow
1. Admin receives a booking request
2. Admin clicks "Assign Provider"
3. Admin fills in:
   - Provider selection
   - Rate per day (UGX)
   - Number of days
   - **Provider Payment (UGX)** ← New field
4. Admin sees:
   - Client Total = rate × days
   - Provider Payment = what admin entered
5. On assignment:
   - Client is charged the total (rate × days)
   - Provider sees and receives the provider payment amount

### Provider Workflow
1. Provider receives notification: "You will receive UGX X"
2. Provider sees assignments with their payment amount
3. Provider completes service
4. Provider sees earnings based on their payment amount

### Example Scenario
- Client books 3 days of nursing care
- Admin sets rate: UGX 50,000/day
- Client total: UGX 150,000 (3 × 50,000)
- Admin sets provider payment: UGX 120,000 (80% of client total)
- **Client pays**: UGX 150,000
- **Provider receives**: UGX 120,000
- **Platform keeps**: UGX 30,000 (difference)

## Benefits

1. **Flexible Pricing**: Set different rates for clients vs providers
2. **Commission Management**: Platform can take a percentage
3. **Provider Incentives**: Offer bonuses or adjust rates per provider
4. **Transparency**: Both parties see their relevant amounts
5. **Separate Concerns**: Client pricing independent of provider payment

## Important Notes

- Provider payment is required when assigning a provider
- Provider payment must be greater than 0
- Provider only sees their payment amount, not client price
- Client sees the total they need to pay
- Admin sees both amounts for full transparency

## Testing

1. Create a new booking as a patient
2. Login as admin
3. Assign a provider with different client total and provider payment
4. Verify provider sees their payment amount
5. Mark payment as paid
6. Check provider earnings show correct amount
