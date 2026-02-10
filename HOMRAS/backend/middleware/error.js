/**
 * გლობალური შეცდომების დამმუშავებელი
 */

class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        
        Error.captureStackTrace(this, this.constructor);
    }
}

const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';
    
    // Development რეჟიმი - დეტალური შეცდომები
    if (process.env.NODE_ENV === 'development') {
        return res.status(err.statusCode).json({
            success: false,
            error: err,
            message: err.message,
            stack: err.stack
        });
    }
    
    // Production რეჟიმი - დაგენერირებული შეცდომები
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message
        });
    }
    
    // გაუთვალისწინებელი შეცდომები
    console.error('ERROR 💥:', err);
    
    return res.status(500).json({
        success: false,
        message: 'დაფიქსირდა შეცდომა. გთხოვთ სცადოთ მოგვიანებით.'
    });
};

// 404 მარშრუტის შეცდომა
const notFound = (req, res, next) => {
    const error = new AppError(`Can't find ${req.originalUrl} on this server!`, 404);
    next(error);
};

// ასინქრონული შეცდომების დამმუშავება
const catchAsync = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};

module.exports = {
    AppError,
    errorHandler,
    notFound,
    catchAsync
}; 
