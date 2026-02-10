/**
 * Multer მიდლვეარი ფოტოების ატვირთვისთვის
 */

const multer = require('multer');
const path = require('path');
const { AppError } = require('./error');

// ფაილის შენახვის კონფიგურაცია
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

// ფაილის ტიპის ვალიდაცია
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new AppError('მხოლოდ სურათების ფაილები დაშვებულია (jpeg, jpg, png, gif, webp)', 400));
    }
};

// Multer ინსტანციის შექმნა
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB მაქსიმუმ
    },
    fileFilter: fileFilter
});

// ერთი სურათის ატვირთვა
const uploadSingle = (fieldName) => {
    return upload.single(fieldName);
};

// მრავალი სურათის ატვირთვა
const uploadMultiple = (fieldName, maxCount = 5) => {
    return upload.array(fieldName, maxCount);
};

// სხვადასხვა ველებისთვის ატვირთვა
const uploadFields = (fields) => {
    return upload.fields(fields);
};

// Cloudinary-სთვის (თუ გამოიყენებთ)
const uploadToCloudinary = async (file) => {
    // Cloudinary იმპლემენტაცია - საჭიროებისამებრ
    return {
        url: `/uploads/${file.filename}`,
        path: file.path,
        filename: file.filename
    };
};

module.exports = {
    upload,
    uploadSingle,
    uploadMultiple,
    uploadFields,
    uploadToCloudinary
}; 
