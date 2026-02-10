/**
 * JWT ავთენტიფიკაციის მიდლვეარი
 */

const jwt = require('jsonwebtoken');
const { AppError } = require('./error');

// მომხმარებლის მოდელის იმპორტი
const User = require('../models/User');

// ტოკენის გენერირება
const generateToken = (userId, role) => {
    return jwt.sign(
        { id: userId, role },
        process.env.JWT_SECRET || 'homras-secret-key-change-in-production',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

// ავთენტიფიკაციის მიდლვეარი
const authenticate = async (req, res, next) => {
    try {
        // ტოკენის მიღება header-დან
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            throw new AppError('თქვენ არ ხართ ავტორიზებული. გთხოვთ შეხვიდეთ სისტემაში.', 401);
        }
        
        // ტოკენის ვერიფიკაცია
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'homras-secret-key-change-in-production'
        );
        
        // მომხმარებლის მონაცემების ძებნა
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            throw new AppError('მომხმარებელი ვერ მოიძებნა', 401);
        }
        
        if (!user.isActive) {
            throw new AppError('თქვენი ანგარიში დაბლოკილია', 403);
        }
        
        // მომხმარებლის მონაცემების დამატება მოთხოვნასთან
        req.user = user;
        req.token = token;
        next();
        
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            next(new AppError('არასწორი ტოკენი', 401));
        } else if (error.name === 'TokenExpiredError') {
            next(new AppError('ტოკენის ვადა გაუვიდა', 401));
        } else {
            next(error);
        }
    }
};

// როლების შემოწმება
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AppError('თქვენ არ ხართ ავტორიზებული', 401));
        }
        
        if (!roles.includes(req.user.role)) {
            return next(new AppError('თქვენ არ გაქვთ ამ მოქმედების შესრულების უფლება', 403));
        }
        
        next();
    };
};

// ადმინისტრატორის შემოწმება
const isAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return next(new AppError('მხოლოდ ადმინისტრატორებს აქვთ წვდომა', 403));
    }
    next();
};

// ხელოსნის შემოწმება
const isHandyman = (req, res, next) => {
    if (!req.user || req.user.role !== 'handyman') {
        return next(new AppError('მხოლოდ ხელოსნებს აქვთ წვდომა', 403));
    }
    next();
};

// მომხმარებლის შემოწმება
const isCustomer = (req, res, next) => {
    if (!req.user || req.user.role !== 'customer') {
        return next(new AppError('მხოლოდ მომხმარებლებს აქვთ წვდომა', 403));
    }
    next();
};

// მომხმარებლის ან ადმინის შემოწმება
const isUserOrAdmin = (req, res, next) => {
    if (!req.user || (req.user.role !== 'customer' && req.user.role !== 'admin')) {
        return next(new AppError('არასაკმარისი უფლებები', 403));
    }
    next();
};

module.exports = {
    generateToken,
    authenticate,
    authorize,
    isAdmin,
    isHandyman,
    isCustomer,
    isUserOrAdmin
}; 
