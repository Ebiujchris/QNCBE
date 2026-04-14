# 🚀 QNC SOLUTIONS - Complete System Startup Guide

## 📋 System Overview

**QNC Solutions** consists of 3 main components:
1. **QNCBE** - Backend API (Express.js + PostgreSQL)
2. **QNCFE** - Main Frontend (React - Patients & Providers)
3. **QNCADMIN** - Admin Panel (React - Administrators)

## ⚡ Quick Start (Recommended Order)

### 1. 🗄️ Start Backend First
```bash
cd QNCBE
npm install
npm run setup-db  # Initialize Neon database
npm run dev       # Runs on http://localhost:5000
```

### 2. 🌐 Start Main Frontend
```bash
cd QNCFE
npm install
npm run dev       # Runs on http://localhost:3000
```

### 3. 🛡️ Start Admin Panel
```bash
cd QNCADMIN
npm install
npm run dev       # Runs on http://localhost:3001
```

## 🔧 Detailed Setup Instructions

### Backend Setup (QNCBE)
```bash
cd QNCBE
npm install

# Database is already configured with Neon PostgreSQL
# Initialize database tables and default admin
npm run setup-db

# Start development server
npm run dev
```

**Backend Features:**
- ✅ Express.js API server
- ✅ Neon PostgreSQL database
- ✅ JWT authentication
- ✅ Role-based access control
- ✅ Booking management
- ✅ Payment tracking
- ✅ Notification system

### Main Frontend Setup (QNCFE)
```bash
cd QNCFE
npm install
npm run dev
```

**Frontend Features:**
- ✅ Patient registration and booking
- ✅ Provider registration and management
- ✅ Unified dashboard system
- ✅ Modern UI with toast notifications
- ✅ Responsive design
- ✅ Real-time updates

### Admin Panel Setup (QNCADMIN)
```bash
cd QNCADMIN
npm install
npm run dev
```

**Admin Panel Features:**
- ✅ Secure admin authentication
- ✅ Pending booking management
- ✅ Provider assignment system
- ✅ User management
- ✅ Payment oversight
- ✅ System analytics

## 🌐 Access Points

| Component | URL | Purpose |
|-----------|-----|---------|
| **Backend API** | http://localhost:5000 | API endpoints |
| **Main App** | http://localhost:3000 | Patients & Providers |
| **Admin Panel** | http://localhost:3001 | System Administration |

## 🔑 Default Credentials

### Admin Account
- **Email**: admin@qnc.com
- **Password**: admin123
- **Registration Code**: QNC2024ADMIN

### Test the System
1. **Register as Patient** on main app (port 3000)
2. **Book a service** as patient
3. **Login as Admin** on admin panel (port 3001)
4. **Assign provider** to the booking
5. **Check notifications** and status updates

## 🔍 Troubleshooting

### ❌ API 400/500 Errors
**Cause**: Backend not running or database connection failed
**Solution**:
```bash
cd QNCBE
npm run dev
# Check console for database connection messages
```

### ❌ CORS Errors
**Cause**: Frontend can't connect to backend
**Solution**: Ensure backend is running on port 5000

### ❌ Database Errors
**Cause**: Database not initialized
**Solution**:
```bash
cd QNCBE
npm run setup-db
```

### ❌ React Router Warnings
**Fixed**: Updated router configuration with future flags

### ❌ Missing vite.svg
**Fixed**: Added favicon files to both frontend projects

## 🧪 System Testing Workflow

### 1. Patient Journey
1. Open http://localhost:3000
2. Register as patient
3. Book a healthcare service
4. Check dashboard for updates

### 2. Admin Journey
1. Open http://localhost:3001
2. Login with admin credentials
3. View pending bookings
4. Assign provider to booking
5. Monitor system statistics

### 3. Provider Journey
1. Register as provider on main app
2. Wait for admin to assign bookings
3. Complete assigned services
4. Track earnings

## 📊 System Health Check

### Backend Health
```bash
curl http://localhost:5000/api/health
# Should return: {"message": "QNC Booking API is running!"}
```

### Database Connection
- Check QNCBE console for "Connected to Neon PostgreSQL database"
- Verify tables exist with default admin user

### Frontend Connectivity
- No 400/500 errors in browser console
- API calls successful
- Toast notifications working

## 🎯 Production Deployment

### Backend (QNCBE)
```bash
npm run build  # If build script exists
# Deploy to your server (Railway, Heroku, etc.)
```

### Frontend (QNCFE)
```bash
npm run build
# Deploy dist/ folder to hosting service
```

### Admin Panel (QNCADMIN)
```bash
npm run build
# Deploy dist/ folder to secure hosting
```

## 🔒 Security Notes

- **Admin Panel**: Requires admin role verification
- **API**: JWT token authentication
- **Database**: Neon PostgreSQL with SSL
- **Passwords**: Bcrypt hashing
- **CORS**: Configured for development

## 📞 Support

### Common Issues
1. **Backend not starting**: Check database connection
2. **Frontend errors**: Ensure backend is running first
3. **Login failures**: Verify credentials and backend connectivity
4. **Database issues**: Run setup script again

### Development Tips
- Always start backend first
- Check browser console for errors
- Monitor backend logs for API issues
- Use browser DevTools Network tab for debugging

---

## ✅ Success Checklist

- [ ] Backend running on port 5000
- [ ] Database connected and initialized
- [ ] Main frontend running on port 3000
- [ ] Admin panel running on port 3001
- [ ] Can register and login users
- [ ] Can book services as patient
- [ ] Can assign providers as admin
- [ ] No console errors
- [ ] All features working

**🎉 System Ready!** Your QNC Solutions healthcare booking system is now fully operational.