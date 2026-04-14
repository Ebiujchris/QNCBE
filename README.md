# QNC Booking Backend

Express.js backend for the QNC Community Care booking system.

## 🚀 Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
```bash
# .env file is already configured with Neon database
# JWT_SECRET and DATABASE_URL are set
```

### 3. Database Setup
```bash
# Initialize Neon database with schema
npm run setup-db
```

### 4. Start Server
```bash
# Development
npm run dev

# Production
npm start
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Bookings
- `POST /api/bookings` - Create booking (patients)
- `GET /api/bookings/my-bookings` - Get patient bookings
- `GET /api/bookings/my-assignments` - Get provider assignments
- `POST /api/bookings/:id/complete` - Mark service complete

### Admin
- `GET /api/admin/bookings/pending` - Get pending bookings
- `GET /api/admin/bookings` - Get all bookings
- `GET /api/admin/providers` - Get available providers
- `POST /api/admin/bookings/:id/assign` - Assign provider
- `GET /api/admin/stats` - System statistics

### Payments
- `POST /api/payments/:bookingId/mark-paid` - Mark payment as paid
- `GET /api/payments/history` - Payment history (admin)

### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/mark-all-read` - Mark all as read

## 🔒 Authentication

Uses JWT tokens. Include in requests:
```
Authorization: Bearer <token>
```

## 🗄 Database Schema

See `database/schema.sql` for complete schema.

## 🧪 Testing

```bash
# Test API health
curl http://localhost:5000/api/health
```

## 📝 Default Admin Account

- Email: admin@qnc.com
- Password: admin123