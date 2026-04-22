# QNC Solutions - Pricing System Backend Update

This document explains the backend changes made to support the new pricing system with UGX currency and earnings tracking.

## 🚀 Quick Setup

### 1. Run Database Migration
```bash
cd QNCBE
node scripts/migrate-pricing.js
```

### 2. Restart Your Server
```bash
npm start
```

## 📊 What's New

### Database Changes
- **Added `price` column** to `bookings` table (DECIMAL(10,2))
- **Enhanced payment tracking** with proper amount handling
- **Performance indexes** for price and payment queries
- **Data migration** for existing bookings

### API Endpoints Updated

#### Admin Endpoints
- `POST /api/admin/bookings/:id/assign` - Now requires `price` parameter
- `GET /api/admin/earnings` - New endpoint for system-wide earnings
- `GET /api/admin/stats` - Enhanced with monthly revenue tracking

#### Provider Endpoints  
- `GET /api/bookings/provider/earnings` - New endpoint for provider earnings

#### Patient Endpoints
- `GET /api/bookings/my-bookings` - Now includes price information
- `POST /api/payments/:bookingId/mark-paid` - Uses actual booking prices

## 🔧 API Changes Details

### 1. Provider Assignment (Admin)
**Endpoint:** `POST /api/admin/bookings/:id/assign`

**New Request Body:**
```json
{
  "providerId": 123,
  "price": 50000
}
```

**Response:** Booking object with price information

### 2. Admin Earnings Overview
**Endpoint:** `GET /api/admin/earnings`

**Response:**
```json
[
  {
    "id": 1,
    "booking_id": 123,
    "amount": "50000.00",
    "payment_date": "2024-01-15T10:30:00Z",
    "service_type": "nursing",
    "patient_name": "John Doe",
    "provider_name": "Jane Smith"
  }
]
```

### 3. Provider Earnings
**Endpoint:** `GET /api/bookings/provider/earnings`

**Response:**
```json
[
  {
    "id": 1,
    "booking_id": 123,
    "amount": "50000.00",
    "payment_date": "2024-01-15T10:30:00Z",
    "service_type": "nursing",
    "patient_name": "John Doe"
  }
]
```

### 4. Enhanced Statistics
**Endpoint:** `GET /api/admin/stats`

**New Fields:**
```json
{
  "totalRevenue": 150000.00,
  "monthlyRevenue": 50000.00,
  // ... existing fields
}
```

## 🗄️ Database Schema Updates

### Bookings Table
```sql
ALTER TABLE bookings ADD COLUMN price DECIMAL(10,2) DEFAULT 0.00;
```

### New Indexes
```sql
CREATE INDEX idx_bookings_price ON bookings(price);
CREATE INDEX idx_payments_amount ON payments(amount);
CREATE INDEX idx_payments_status_date ON payments(status, payment_date);
```

## 🔄 Migration Details

The migration script (`scripts/migrate-pricing.js`) will:

1. **Add price column** to existing bookings table
2. **Set default prices** for existing assigned/paid/completed bookings (UGX 50,000)
3. **Create payment records** for existing bookings without payment entries
4. **Add performance indexes** for better query performance
5. **Verify migration** with statistics output

## 💰 Currency Handling

- All prices stored as `DECIMAL(10,2)` in database
- Frontend displays with UGX currency and thousand separators
- API returns numeric values, frontend handles formatting

## 🔐 Security & Validation

- **Admin-only pricing**: Only admins can set prices during assignment
- **Price validation**: Ensures positive numeric values
- **Booking ownership**: Patients can only pay for their own bookings
- **Provider earnings**: Providers only see their own earnings

## 🧪 Testing the Changes

### 1. Test Admin Assignment with Pricing
```bash
curl -X POST http://localhost:5000/api/admin/bookings/1/assign \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"providerId": 2, "price": 75000}'
```

### 2. Test Provider Earnings
```bash
curl -X GET http://localhost:5000/api/bookings/provider/earnings \
  -H "Authorization: Bearer YOUR_PROVIDER_TOKEN"
```

### 3. Test Admin Earnings Overview
```bash
curl -X GET http://localhost:5000/api/admin/earnings \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## 🚨 Important Notes

1. **Run migration before starting server** to avoid database errors
2. **Existing bookings** will get default price of UGX 50,000 (adjust as needed)
3. **Payment records** are automatically created for existing assigned bookings
4. **Backup your database** before running migration in production

## 📈 Expected Results

After successful migration and server restart:
- ✅ Admin can set prices during provider assignment
- ✅ Patients see service prices before payment
- ✅ Providers can track their earnings
- ✅ Admin has comprehensive earnings overview
- ✅ All amounts display in UGX with proper formatting

## 🆘 Troubleshooting

### Migration Fails
- Check database connection in `config/database.js`
- Ensure PostgreSQL is running
- Verify user has ALTER TABLE permissions

### API Errors
- Check server logs for detailed error messages
- Verify JWT tokens are valid
- Ensure proper role-based access

### Frontend Issues
- Clear browser cache
- Check network tab for API response errors
- Verify API base URL in frontend config