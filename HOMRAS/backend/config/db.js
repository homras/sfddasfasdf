/**
 * მონაცემთა ბაზის კონფიგურაცია
 */

const mongoose = require('mongoose');

// Connection URI
const getMongoURI = () => {
    if (process.env.MONGODB_URI) {
        return process.env.MONGODB_URI;
    }
    
    // Development URI
    return 'mongodb://localhost:27017/homras';
};

// Connection options
const connectionOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4 // IPv4-ის გამოყენება
};

// MongoDB event handlers
const setupMongoEvents = () => {
    mongoose.connection.on('connected', () => {
        console.log('✅ MongoDB connected successfully');
    });
    
    mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
        console.log('⚠️ MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
        console.log('🔁 MongoDB reconnected');
    });
    
    mongoose.connection.on('reconnectFailed', () => {
        console.error('❌ MongoDB reconnect failed');
    });
};

// Connect to database
const connectDatabase = async () => {
    try {
        const uri = getMongoURI();
        console.log(`🔗 Connecting to MongoDB: ${uri.replace(/:([^:]+)@/, ':****@')}`);
        
        await mongoose.connect(uri, connectionOptions);
        
        setupMongoEvents();
        
        return mongoose.connection;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        process.exit(1);
    }
};

// Close database connection
const closeDatabase = async () => {
    try {
        await mongoose.connection.close();
        console.log('📴 Database connection closed');
    } catch (error) {
        console.error('Error closing database:', error);
    }
};

// Check database connection status
const getDatabaseStatus = () => {
    return {
        connected: mongoose.connection.readyState === 1,
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        name: mongoose.connection.name,
        models: Object.keys(mongoose.models)
    };
};

module.exports = {
    connectDatabase,
    closeDatabase,
    getDatabaseStatus,
    mongoose
}; 
