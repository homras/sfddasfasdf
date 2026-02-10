/**
 * User მოდელი - მომხმარებლის მონაცემთა სქემა
 * ტიპები: admin, customer, handyman
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

// მომხმარებლის სქემა
const userSchema = new mongoose.Schema({
    // პირადი ინფორმაცია
    name: {
        type: String,
        required: [true, 'სახელი აუცილებელია'],
        trim: true,
        minlength: [2, 'სახელი უნდა შეიცავდეს მინიმუმ 2 სიმბოლოს'],
        maxlength: [100, 'სახელი არ უნდა აღემატებოდეს 100 სიმბოლოს']
    },
    
    email: {
        type: String,
        required: [true, 'ელ. ფოსტა აუცილებელია'],
        unique: true,
        lowercase: true,
        trim: true,
        validate: [validator.isEmail, 'გთხოვთ შეიყვანოთ სწორი ელ. ფოსტა']
    },
    
    phone: {
        type: String,
        required: [true, 'ტელეფონის ნომერი აუცილებელია'],
        trim: true,
        validate: {
            validator: function(v) {
                // საქართველოს ტელეფონის ნომრის ფორმატი
                return /^(?:\+995|995|0)?(5\d{2}|7\d{2}|8\d{2})\d{6}$/.test(v.replace(/\s/g, ''));
            },
            message: 'გთხოვთ შეიყვანოთ სწორი ტელეფონის ნომერი'
        }
    },
    
    // ავთენტიფიკაცია
    password: {
        type: String,
        required: [true, 'პაროლი აუცილებელია'],
        minlength: [6, 'პაროლი უნდა შეიცავდეს მინიმუმ 6 სიმბოლოს'],
        select: false // არ დაბრუნდეს API-ზე
    },
    
    role: {
        type: String,
        enum: {
            values: ['admin', 'customer', 'handyman'],
            message: 'როლი უნდა იყოს: admin, customer ან handyman'
        },
        default: 'customer'
    },
    
    // პროფილის სურათი
    avatar: {
        type: String,
        default: '/images/default-avatar.png'
    },
    
    // სტატუსი
    isActive: {
        type: Boolean,
        default: true
    },
    
    isVerified: {
        type: Boolean,
        default: false
    },
    
    verificationToken: String,
    verificationExpires: Date,
    
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    
    // მდებარეობა
    city: {
        type: String,
        enum: ['batumi', 'tbilisi', 'kutaisi', 'other'],
        default: 'batumi'
    },
    
    address: {
        type: String,
        trim: true,
        maxlength: [200, 'მისამართი არ უნდა აღემატებოდეს 200 სიმბოლოს']
    },
    
    // ხელოსნისთვის დამატებითი ველები
    skills: [{
        type: String,
        enum: ['plumbing', 'electrical', 'repair', 'cleaning', 'carpentry', 'painting', 'gardening']
    }],
    
    experience: {
        type: Number, // წლებში
        min: 0,
        max: 50
    },
    
    bio: {
        type: String,
        maxlength: [500, 'ბიოგრაფია არ უნდა აღემატებოდეს 500 სიმბოლოს']
    },
    
    hourlyRate: {
        type: Number,
        min: 0
    },
    
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    
    totalReviews: {
        type: Number,
        default: 0
    },
    
    completedJobs: {
        type: Number,
        default: 0
    },
    
    // დამატებითი ინფორმაცია
    languages: [{
        type: String,
        enum: ['ka', 'en', 'ru']
    }],
    
    availability: {
        type: String,
        enum: ['available', 'busy', 'on_vacation'],
        default: 'available'
    },
    
    // დოკუმენტები და დამოწმებები
    documents: [{
        name: String,
        url: String,
        verified: {
            type: Boolean,
            default: false
        }
    }],
    
    // სტატისტიკა
    lastLogin: Date,
    loginCount: {
        type: Number,
        default: 0
    },
    
    // ფინანსური ინფორმაცია (ხელოსნებისთვის)
    balance: {
        type: Number,
        default: 0
    },
    
    paymentMethod: {
        type: String,
        enum: ['bank_transfer', 'cash', 'card'],
        default: 'cash'
    },
    
    bankAccount: {
        bankName: String,
        accountNumber: String,
        accountHolder: String
    },
    
    // პრეფერენციები
    preferences: {
        notifications: {
            email: { type: Boolean, default: true },
            sms: { type: Boolean, default: true },
            push: { type: Boolean, default: true }
        },
        language: {
            type: String,
            enum: ['ka', 'en', 'ru'],
            default: 'ka'
        },
        currency: {
            type: String,
            default: 'GEL'
        }
    },
    
    // მეტა-ინფორმაცია
    metadata: {
        ipAddress: String,
        userAgent: String,
        deviceType: String
    }

}, {
    timestamps: true, // createdAt და updatedAt ავტომატურად
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// ვირტუალური ველები
userSchema.virtual('fullProfile').get(function() {
    return {
        id: this._id,
        name: this.name,
        email: this.email,
        phone: this.phone,
        role: this.role,
        avatar: this.avatar,
        city: this.city,
        rating: this.rating,
        completedJobs: this.completedJobs,
        isVerified: this.isVerified,
        isActive: this.isActive
    };
});

userSchema.virtual('handymanProfile').get(function() {
    if (this.role !== 'handyman') return null;
    
    return {
        id: this._id,
        name: this.name,
        avatar: this.avatar,
        skills: this.skills,
        experience: this.experience,
        bio: this.bio,
        hourlyRate: this.hourlyRate,
        rating: this.rating,
        totalReviews: this.totalReviews,
        completedJobs: this.completedJobs,
        city: this.city,
        availability: this.availability,
        languages: this.languages
    };
});

// ინდექსები სწრაფი ძიებისთვის
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ city: 1 });
userSchema.index({ rating: -1 });
userSchema.index({ isActive: 1 });
userSchema.index({ 'skills': 1 });
userSchema.index({ createdAt: -1 });

// Middleware-ები

// პაროლის ჰეშირება სანამ შენახვა
userSchema.pre('save', async function(next) {
    // მხოლოდ იმ შემთხვევაში თუ პაროლი შეცვლილია
    if (!this.isModified('password')) return next();
    
    try {
        // მარილის გენერირება
        const salt = await bcrypt.genSalt(10);
        // პაროლის ჰეშირება
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// პაროლის შეცვლის შემდეგ
userSchema.post('save', function(doc, next) {
    console.log(`User ${doc.email} saved/updated`);
    next();
});

// მეთოდები

// პაროლის შემოწმება
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error('პაროლის შემოწმების შეცდომა');
    }
};

// ტოკენის გენერირება
userSchema.methods.generateAuthToken = function() {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
        { id: this._id, role: this.role },
        process.env.JWT_SECRET || 'homras-secret-key',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

// გამოტანისთვის უსაფრთხო მონაცემები
userSchema.methods.toSafeObject = function() {
    const userObject = this.toObject();
    delete userObject.password;
    delete userObject.__v;
    delete userObject.verificationToken;
    delete userObject.verificationExpires;
    delete userObject.resetPasswordToken;
    delete userObject.resetPasswordExpires;
    delete userObject.metadata;
    return userObject;
};

// რეიტინგის განახლება
userSchema.methods.updateRating = async function(newRating) {
    try {
        // ახალი საშუალო რეიტინგის გამოთვლა
        const totalScore = (this.rating * this.totalReviews) + newRating;
        this.totalReviews += 1;
        this.rating = totalScore / this.totalReviews;
        
        // დამრგვალება 2 ათობითი ნიშნამდე
        this.rating = Math.round(this.rating * 100) / 100;
        
        await this.save();
        return this.rating;
    } catch (error) {
        throw new Error('რეიტინგის განახლების შეცდომა: ' + error.message);
    }
};

// სტატიკური მეთოდები

// ელ.ფოსტის მიხედვით მომხმარებლის პოვნა
userSchema.statics.findByEmail = async function(email) {
    return await this.findOne({ email: email.toLowerCase() });
};

// ხელოსნების ძებნა
userSchema.statics.findHandymen = async function(filters = {}) {
    const {
        city,
        skills,
        minRating,
        maxHourlyRate,
        availability,
        page = 1,
        limit = 10,
        sortBy = 'rating',
        sortOrder = 'desc'
    } = filters;
    
    const query = { role: 'handyman', isActive: true };
    
    if (city && city !== 'all') query.city = city;
    if (skills && skills.length > 0) query.skills = { $in: skills };
    if (minRating) query.rating = { $gte: minRating };
    if (maxHourlyRate) query.hourlyRate = { $lte: maxHourlyRate };
    if (availability) query.availability = availability;
    
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const skip = (page - 1) * limit;
    
    const [users, total] = await Promise.all([
        this.find(query)
            .select('-password -__v -verificationToken -resetPasswordToken')
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit)),
        this.countDocuments(query)
    ]);
    
    return {
        users,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
    };
};

// აქტიური მომხმარებლების რაოდენობა
userSchema.statics.getStats = async function() {
    const stats = await this.aggregate([
        {
            $group: {
                _id: '$role',
                count: { $sum: 1 },
                active: {
                    $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
                },
                verified: {
                    $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] }
                },
                avgRating: { $avg: '$rating' }
            }
        },
        {
            $project: {
                role: '$_id',
                count: 1,
                active: 1,
                verified: 1,
                avgRating: { $round: ['$avgRating', 2] },
                _id: 0
            }
        }
    ]);
    
    const total = await this.countDocuments();
    const active = await this.countDocuments({ isActive: true });
    
    return {
        total,
        active,
        byRole: stats.reduce((acc, stat) => {
            acc[stat.role] = stat;
            return acc;
        }, {})
    };
};

// ვალიდაციის მეთოდები
userSchema.statics.validateUserData = function(data) {
    const errors = [];
    
    // სახელის ვალიდაცია
    if (!data.name || data.name.trim().length < 2) {
        errors.push('სახელი უნდა შეიცავდეს მინიმუმ 2 სიმბოლოს');
    }
    
    // ელ.ფოსტის ვალიდაცია
    if (!data.email || !validator.isEmail(data.email)) {
        errors.push('გთხოვთ შეიყვანოთ სწორი ელ. ფოსტა');
    }
    
    // ტელეფონის ვალიდაცია
    if (!data.phone) {
        errors.push('ტელეფონის ნომერი აუცილებელია');
    }
    
    // პაროლის ვალიდაცია
    if (data.password && data.password.length < 6) {
        errors.push('პაროლი უნდა შეიცავდეს მინიმუმ 6 სიმბოლოს');
    }
    
    // როლის ვალიდაცია
    if (data.role && !['admin', 'customer', 'handyman'].includes(data.role)) {
        errors.push('არასწორი როლი');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
};

// შექმენით მოდელი
const User = mongoose.model('User', userSchema);

module.exports = User; 
