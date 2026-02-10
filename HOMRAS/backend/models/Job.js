/**
 * Job მოდელი - სამუშაო განცხადებები
 */

const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
    // ძირითადი ინფორმაცია
    title: {
        type: String,
        required: [true, 'სათაური აუცილებელია'],
        trim: true,
        minlength: [5, 'სათაური უნდა შეიცავდეს მინიმუმ 5 სიმბოლოს'],
        maxlength: [200, 'სათაური არ უნდა აღემატებოდეს 200 სიმბოლოს']
    },
    
    description: {
        type: String,
        required: [true, 'აღწერა აუცილებელია'],
        trim: true,
        minlength: [20, 'აღწერა უნდა შეიცავდეს მინიმუმ 20 სიმბოლოს'],
        maxlength: [2000, 'აღწერა არ უნდა აღემატებოდეს 2000 სიმბოლოს']
    },
    
    category: {
        type: String,
        required: [true, 'კატეგორია აუცილებელია'],
        enum: {
            values: ['plumbing', 'electrical', 'repair', 'cleaning', 'carpentry', 'painting', 'gardening', 'other'],
            message: 'კატეგორია უნდა იყოს: plumbing, electrical, repair, cleaning, carpentry, painting, gardening, other'
        }
    },
    
    // მდებარეობა
    city: {
        type: String,
        required: [true, 'ქალაქი აუცილებელია'],
        enum: ['batumi', 'tbilisi', 'kutaisi', 'zugdidi', 'rustavi', 'poti', 'gori', 'other']
    },
    
    address: {
        type: String,
        required: [true, 'მისამართი აუცილებელია'],
        trim: true,
        maxlength: [500, 'მისამართი არ უნდა აღემატებოდეს 500 სიმბოლოს']
    },
    
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            default: [0, 0]
        }
    },
    
    // ფინანსები
    budget: {
        type: Number,
        min: [0, 'ბიუჯეტი არ შეიძლება იყოს უარყოფითი']
    },
    
    budgetType: {
        type: String,
        enum: ['fixed', 'hourly', 'negotiable'],
        default: 'negotiable'
    },
    
    currency: {
        type: String,
        default: 'GEL'
    },
    
    // დამკვეთი
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    customerName: String,
    customerPhone: String,
    
    // ხელოსანი (თუ დანიშნულია)
    handyman: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    handymanName: String,
    handymanPhone: String,
    
    // სტატუსი
    status: {
        type: String,
        enum: ['open', 'in_progress', 'completed', 'cancelled', 'closed'],
        default: 'open'
    },
    
    // ვადები
    deadline: Date,
    estimatedDuration: Number, // საათებში
    
    // სურათები
    photos: [String],
    
    // აპლიკაციები
    applications: [{
        handyman: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        handymanName: String,
        handymanAvatar: String,
        proposal: String,
        bidAmount: Number,
        estimatedTime: Number, // საათებში
        status: {
            type: String,
            enum: ['pending', 'accepted', 'rejected'],
            default: 'pending'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    
    // შეთავაზებები
    offers: [{
        handyman: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        amount: Number,
        message: String,
        status: {
            type: String,
            enum: ['pending', 'accepted', 'rejected'],
            default: 'pending'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    
    // შეფასება
    review: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Review'
    },
    
    rating: Number,
    
    // მეტა-ინფორმაცია
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    
    visibility: {
        type: String,
        enum: ['public', 'private'],
        default: 'public'
    },
    
    tags: [String],
    
    // სტატისტიკა
    views: {
        type: Number,
        default: 0
    },
    
    applicationCount: {
        type: Number,
        default: 0
    },
    
    // დამატებითი ინფორმაცია
    requirements: [String],
    
    specialInstructions: String,
    
    // დროის შტამპები
    publishedAt: {
        type: Date,
        default: Date.now
    },
    
    startedAt: Date,
    completedAt: Date,
    cancelledAt: Date

}, {
    timestamps: true
});

// ინდექსები
jobSchema.index({ customer: 1 });
jobSchema.index({ handyman: 1 });
jobSchema.index({ status: 1 });
jobSchema.index({ category: 1 });
jobSchema.index({ city: 1 });
jobSchema.index({ budget: 1 });
jobSchema.index({ createdAt: -1 });
jobSchema.index({ location: '2dsphere' });
jobSchema.index({ title: 'text', description: 'text' });

// ვირტუალური ველები
jobSchema.virtual('isOpen').get(function() {
    return this.status === 'open';
});

jobSchema.virtual('isCompleted').get(function() {
    return this.status === 'completed';
});

jobSchema.virtual('timeSincePosted').get(function() {
    const now = new Date();
    const posted = new Date(this.createdAt);
    const diffInHours = Math.floor((now - posted) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
        return `${diffInHours} საათის წინ`;
    } else if (diffInHours < 168) { // 7 დღე
        const days = Math.floor(diffInHours / 24);
        return `${days} დღის წინ`;
    } else {
        return this.createdAt.toLocaleDateString('ka-GE');
    }
});

// Middleware-ები
jobSchema.pre('save', function(next) {
    // ავტომატურად შეინახოს customerName
    if (this.isModified('customer') && !this.customerName) {
        this.customerName = 'Loading...';
    }
    
    // გამოთვალოს applicationCount
    if (this.applications && Array.isArray(this.applications)) {
        this.applicationCount = this.applications.length;
    }
    
    next();
});

// მეთოდები
jobSchema.methods.applyForJob = async function(handymanId, proposal, bidAmount, estimatedTime) {
    const application = {
        handyman: handymanId,
        proposal,
        bidAmount,
        estimatedTime,
        status: 'pending'
    };
    
    this.applications.push(application);
    this.applicationCount = this.applications.length;
    
    await this.save();
    return application;
};

jobSchema.methods.acceptApplication = async function(applicationId) {
    const application = this.applications.id(applicationId);
    
    if (!application) {
        throw new Error('აპლიკაცია ვერ მოიძებნა');
    }
    
    application.status = 'accepted';
    this.handyman = application.handyman;
    this.status = 'in_progress';
    this.startedAt = new Date();
    
    // ყველა დანარჩენი აპლიკაცია უარყოფილი
    this.applications.forEach(app => {
        if (app._id.toString() !== applicationId.toString()) {
            app.status = 'rejected';
        }
    });
    
    await this.save();
    return application;
};

jobSchema.statics.findByFilters = async function(filters = {}) {
    const {
        category,
        city,
        minBudget,
        maxBudget,
        status = 'open',
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search,
        customerId,
        handymanId
    } = filters;
    
    const query = {};
    
    if (category && category !== 'all') query.category = category;
    if (city && city !== 'all') query.city = city;
    if (status && status !== 'all') query.status = status;
    if (customerId) query.customer = customerId;
    if (handymanId) query.handyman = handymanId;
    
    if (minBudget !== undefined || maxBudget !== undefined) {
        query.budget = {};
        if (minBudget !== undefined) query.budget.$gte = minBudget;
        if (maxBudget !== undefined) query.budget.$lte = maxBudget;
    }
    
    if (search) {
        query.$text = { $search: search };
    }
    
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const skip = (page - 1) * limit;
    
    const [jobs, total] = await Promise.all([
        this.find(query)
            .populate('customer', 'name avatar phone rating')
            .populate('handyman', 'name avatar phone rating')
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit)),
        this.countDocuments(query)
    ]);
    
    return {
        jobs,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
    };
};

const Job = mongoose.model('Job', jobSchema);

module.exports = Job; 
