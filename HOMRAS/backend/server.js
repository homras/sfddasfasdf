/**
 * HOMRAS - Backend Server
 * ძირითადი Express სერვერი MongoDB-სთან, JWT ავთენტიფიკაციით და REST API-ით
 * Render.com-ისთვის მორგებული ვერსია
 */

// ბიბლიოთეკების იმპორტი
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// მარშრუტების იმპორტი
const authRoutes = require('./routes/auth');
const jobRoutes = require('./routes/jobs');
const userRoutes = require('./routes/users');
const reviewRoutes = require('./routes/reviews');
const adminRoutes = require('./routes/admin');

// Middleware ფაილების იმპორტი
const { authenticate } = require('./middleware/auth');
const { errorHandler } = require('./middleware/error');

// ანიციალიზაცია
const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// 🚨 🚨 🚨 **რეკომენდირებული ცვლილება: MongoDB კავშირი რომ არ შეაჩეროს სერვერი**
const connectDB = async () => {
    try {
        // თუ MONGODB_URI არ არის (render.com-ზე), გაეშვას დემო რეჟიმში
        if (!process.env.MONGODB_URI || process.env.MONGODB_URI === 'mongodb://localhost:27017/homras') {
            console.log('⚠️  Running in DEMO mode without MongoDB');
            console.log('ℹ️  To use MongoDB, set MONGODB_URI environment variable');
            return false; // არ გაუშვას process.exit()
        }
        
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log(`✅ MongoDB უკავშირდება: ${conn.connection.host}`);
        
        // კავშირის მოვლენების მოსმენა
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB კავშირის შეცდომა:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.log('⚠️ MongoDB კავშირი გაწყვეტილია');
        });
        
        return true;
        
    } catch (error) {
        console.error('❌ MongoDB კავშირის შეცდომა:', error.message);
        console.log('⚠️  Server will continue in DEMO mode without database');
        return false; // 🚨 არ გაუშვას process.exit(1) - სერვერი გაგრძელდება!
    }
};

// ძირითადი მიდლვეარები
const setupMiddleware = () => {
    // უსაფრთხოების ჰელმეტი
    app.use(helmet());
    
    // CORS კონფიგურაცია - render.com-ისთვის მარტივი
    app.use(cors({
        origin: '*', // 🚨 დეველოპმენტისთვის, მოგვიანებით შეცვალეთ
        credentials: true,
    }));
    
    // Rate limiting
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 წუთი
        max: 100, // 100 მოთხოვნა IP-დან
        message: 'ძალიან ბევრი მოთხოვნა ამ IP-დან, გთხოვთ სცადოთ მოგვიანებით',
        standardHeaders: true,
        legacyHeaders: false,
    });
    
    app.use('/api/', limiter);
    
    // JSON პარსირება
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // მორგანი - HTTP მოთხოვნების ლოგირება
    if (NODE_ENV === 'development') {
        app.use(morgan('dev'));
    } else {
        app.use(morgan('combined'));
    }
    
    // სტატიკური ფაილები
    app.use('/uploads', express.static('public/uploads'));
    
    // ძირითადი მარშრუტი
    app.get('/', (req, res) => {
        res.json({
            message: 'HOMRAS API არის ონლაინ',
            version: '1.0.0',
            environment: NODE_ENV,
            database: process.env.MONGODB_URI ? 'Connected' : 'Demo Mode',
            documentation: '/api-docs',
            endpoints: {
                auth: '/api/auth',
                jobs: '/api/jobs',
                users: '/api/users',
                reviews: '/api/reviews',
                admin: '/api/admin'
            }
        });
    });
    
    // API დოკუმენტაციის მარშრუტი
    app.get('/api-docs', (req, res) => {
        res.json({
            title: 'HOMRAS API დოკუმენტაცია',
            baseURL: `${req.protocol}://${req.get('host')}/api`,
            authentication: {
                type: 'Bearer Token',
                header: 'Authorization: Bearer <token>'
            },
            endpoints: {
                auth: {
                    register: 'POST /auth/register',
                    login: 'POST /auth/login',
                    verify: 'GET /auth/verify',
                    refresh: 'POST /auth/refresh'
                },
                jobs: {
                    getAll: 'GET /jobs',
                    getOne: 'GET /jobs/:id',
                    create: 'POST /jobs',
                    update: 'PUT /jobs/:id',
                    delete: 'DELETE /jobs/:id',
                    apply: 'POST /jobs/:id/apply'
                },
                users: {
                    profile: 'GET /users/profile',
                    update: 'PUT /users/profile',
                    handymen: 'GET /users/handymen'
                }
            }
        });
    });
    
    // API მარშრუტები
    app.use('/api/auth', authRoutes);
    app.use('/api/jobs', jobRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/reviews', reviewRoutes);
    app.use('/api/admin', adminRoutes);
    
    // 404 მარშრუტი
    app.use('*', (req, res) => {
        res.status(404).json({
            success: false,
            message: 'მარშრუტი არ მოიძებნა',
            requestedUrl: req.originalUrl,
            method: req.method,
            timestamp: new Date().toISOString()
        });
    });
    
    // გლობალური შეცდომების დამმუშავებელი
    app.use(errorHandler);
};

// სერვერის გაშვება
const startServer = async () => {
    try {
        // MongoDB კავშირი (არასავალდებულო)
        const dbConnected = await connectDB();
        
        if (!dbConnected) {
            console.log('📝 Running in DEMO mode - admin panel will show sample data');
        }
        
        // მიდლვეარების დაყენება
        setupMiddleware();
        
        // 🚨 **რეკომენდირებული ცვლილება: render.com-ისთვის '0.0.0.0'**
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server გაშვებულია ${NODE_ENV} რეჟიმში`);
            console.log(`📡 Port: ${PORT}`);
            console.log(`🌐 URL: http://0.0.0.0:${PORT}`);
            console.log(`📊 Admin Panel: http://0.0.0.0:${PORT}/api/admin/health`);
            console.log(dbConnected ? '✅ Database: Connected' : '⚠️  Database: Demo Mode');
        });
        
        // სერვერის შეცდომების მართვა
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${PORT} უკვე გამოყენებულია`);
                process.exit(1);
            } else {
                console.error('სერვერის შეცდომა:', error);
            }
        });
        
        // სიგნალების დამუშავება
        process.on('SIGTERM', () => {
            console.log('SIGTERM სიგნალი მიღებულია, სერვერის გამორთვა...');
            server.close(() => {
                console.log('სერვერი გამორთულია');
                if (mongoose.connection.readyState === 1) {
                    mongoose.connection.close(false, () => {
                        console.log('MongoDB კავშირი დასრულდა');
                        process.exit(0);
                    });
                } else {
                    process.exit(0);
                }
            });
        });
        
        process.on('SIGINT', () => {
            console.log('SIGINT სიგნალი მიღებულია (Ctrl+C)');
            server.close(() => {
                console.log('სერვერი გამორთულია');
                if (mongoose.connection.readyState === 1) {
                    mongoose.connection.close(false, () => {
                        console.log('MongoDB კავშირი დასრულდა');
                        process.exit(0);
                    });
                } else {
                    process.exit(0);
                }
            });
        });
        
        // გაუთვალისწინებელი შეცდომების მართვა
        process.on('uncaughtException', (error) => {
            console.error('გაუთვალისწინებელი შეცდომა:', error);
            process.exit(1);
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            console.error('დაუმუშავებელი Promise rejection:', reason);
        });
        
    } catch (error) {
        console.error('სერვერის გაშვების შეცდომა:', error);
        process.exit(1);
    }
};

// სერვერის გაშვება
if (require.main === module) {
    startServer();
}

// ექსპორტი ტესტირებისთვის
module.exports = app;