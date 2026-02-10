/**
 * Review მოდელი - შეფასებები და რევიუები
 */

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    // რევიუის მიმართულება
    job: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
        required: true
    },
    
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    handyman: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // შეფასება
    rating: {
        type: Number,
        required: true,
        min: [1, 'რეიტინგი უნდა იყოს მინიმუმ 1'],
        max: [5, 'რეიტინგი არ უნდა აღემატებოდეს 5']
    },
    
    comment: {
        type: String,
        trim: true,
        maxlength: [1000, 'კომენტარი არ უნდა აღემატებოდეს 1000 სიმბოლოს']
    },
    
    // კატეგორიული შეფასებები
    categories: {
        professionalism: {
            type: Number,
            min: 1,
            max: 5
        },
        quality: {
            type: Number,
            min: 1,
            max: 5
        },
        punctuality: {
            type: Number,
            min: 1,
            max: 5
        },
        communication: {
            type: Number,
            min: 1,
            max: 5
        },
        price: {
            type: Number,
            min: 1,
            max: 5
        }
    },
    
    // პასუხი ხელოსნისგან
    reply: {
        text: String,
        repliedAt: Date
    },
    
    // ლაიქები
    helpful: {
        type: Number,
        default: 0
    },
    
    notHelpful: {
        type: Number,
        default: 0
    },
    
    // სტატუსი
    isVerified: {
        type: Boolean,
        default: false
    },
    
    isEdited: {
        type: Boolean,
        default: false
    },
    
    // მედია
    photos: [String],
    
    // მეტა-ინფორმაცია
    ipAddress: String,
    userAgent: String

}, {
    timestamps: true
});

// ინდექსები
reviewSchema.index({ job: 1 }, { unique: true });
reviewSchema.index({ customer: 1 });
reviewSchema.index({ handyman: 1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ handyman: 1, rating: 1 });

// შეფასების განახლება
reviewSchema.methods.updateHelpful = async function(isHelpful) {
    if (isHelpful) {
        this.helpful += 1;
    } else {
        this.notHelpful += 1;
    }
    
    await this.save();
    return { helpful: this.helpful, notHelpful: this.notHelpful };
};

reviewSchema.methods.addReply = async function(replyText) {
    this.reply = {
        text: replyText,
        repliedAt: new Date()
    };
    
    await this.save();
    return this.reply;
};

reviewSchema.statics.getAverageRating = async function(handymanId) {
    const result = await this.aggregate([
        { $match: { handyman: mongoose.Types.ObjectId(handymanId) } },
        {
            $group: {
                _id: '$handyman',
                averageRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 },
                professionalism: { $avg: '$categories.professionalism' },
                quality: { $avg: '$categories.quality' },
                punctuality: { $avg: '$categories.punctuality' },
                communication: { $avg: '$categories.communication' },
                price: { $avg: '$categories.price' }
            }
        }
    ]);
    
    return result[0] || {
        averageRating: 0,
        totalReviews: 0,
        professionalism: 0,
        quality: 0,
        punctuality: 0,
        communication: 0,
        price: 0
    };
};

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review; 
