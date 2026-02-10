/**
 * HandymanProfile - ხელოსნის დეტალური პროფილი
 */

const mongoose = require('mongoose');

const handymanProfileSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    
    // პროფესიონალური ინფორმაცია
    companyName: String,
    taxId: String,
    
    // სერვისის არეალი
    serviceAreas: [{
        type: String,
        enum: ['batumi', 'tbilisi', 'kutaisi', 'zugdidi', 'rustavi', 'poti', 'gori', 'other']
    }],
    
    // სერვისები
    services: [{
        name: String,
        description: String,
        priceType: {
            type: String,
            enum: ['hourly', 'fixed', 'per_item']
        },
        minPrice: Number,
        maxPrice: Number
    }],
    
    // სამუშაო საათები
    workingHours: {
        monday: { from: String, to: String, available: Boolean },
        tuesday: { from: String, to: String, available: Boolean },
        wednesday: { from: String, to: String, available: Boolean },
        thursday: { from: String, to: String, available: Boolean },
        friday: { from: String, to: String, available: Boolean },
        saturday: { from: String, to: String, available: Boolean },
        sunday: { from: String, to: String, available: Boolean }
    },
    
    // განათლება და სერთიფიკატები
    education: [{
        institution: String,
        degree: String,
        field: String,
        year: Number,
        certificateUrl: String
    }],
    
    certificates: [{
        name: String,
        issuingOrganization: String,
        issueDate: Date,
        expiryDate: Date,
        certificateUrl: String,
        verified: {
            type: Boolean,
            default: false
        }
    }],
    
    // პორტფოლიო
    portfolio: [{
        title: String,
        description: String,
        images: [String],
        category: String,
        location: String,
        completedDate: Date,
        clientName: String,
        clientFeedback: String
    }],
    
    // ჯილდოები და აღიარება
    awards: [{
        title: String,
        organization: String,
        year: Number,
        description: String
    }],
    
    // სოციალური ბმულები
    socialLinks: {
        website: String,
        facebook: String,
        instagram: String,
        linkedin: String,
        youtube: String
    },
    
    // სტატისტიკა
    responseTime: { // საათებში
        type: Number,
        default: 24
    },
    
    completionRate: { // პროცენტებში
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    
    onTimeRate: { // პროცენტებში
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    
    repeatClients: {
        type: Number,
        default: 0
    },
    
    // დამატებითი ინფორმაცია
    equipment: [{
        name: String,
        description: String,
        available: Boolean
    }],
    
    teamMembers: [{
        name: String,
        role: String,
        experience: Number,
        certified: Boolean
    }],
    
    insurance: {
        hasInsurance: Boolean,
        provider: String,
        policyNumber: String,
        expiryDate: Date
    },
    
    // პრემიუმ ფუნქციები
    isFeatured: {
        type: Boolean,
        default: false
    },
    
    featuredUntil: Date,
    
    subscription: {
        type: String,
        enum: ['free', 'basic', 'premium'],
        default: 'free'
    },
    
    subscriptionExpires: Date,

}, {
    timestamps: true
});

// ინდექსები
handymanProfileSchema.index({ user: 1 });
handymanProfileSchema.index({ 'serviceAreas': 1 });
handymanProfileSchema.index({ rating: -1 });
handymanProfileSchema.index({ isFeatured: 1 });
handymanProfileSchema.index({ subscription: 1 });

// ვირტუალური ველები
handymanProfileSchema.virtual('fullProfile').get(function() {
    return {
        id: this._id,
        user: this.user,
        companyName: this.companyName,
        serviceAreas: this.serviceAreas,
        services: this.services,
        workingHours: this.workingHours,
        education: this.education,
        certificates: this.certificates,
        portfolio: this.portfolio,
        awards: this.awards,
        socialLinks: this.socialLinks,
        responseTime: this.responseTime,
        completionRate: this.completionRate,
        onTimeRate: this.onTimeRate,
        repeatClients: this.repeatClients,
        equipment: this.equipment,
        teamMembers: this.teamMembers,
        insurance: this.insurance,
        isFeatured: this.isFeatured,
        subscription: this.subscription,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
});

const HandymanProfile = mongoose.model('HandymanProfile', handymanProfileSchema);

module.exports = HandymanProfile; 
