/**
 * Message მოდელი - შეტყობინებები მომხმარებლებს შორის
 */

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    // გამგზავნი და მიმღები
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // კონტექსტი
    job: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job'
    },
    
    // შინაარსი
    subject: {
        type: String,
        trim: true,
        maxlength: [200, 'თემა არ უნდა აღემატებოდეს 200 სიმბოლოს']
    },
    
    content: {
        type: String,
        required: [true, 'შეტყობინების ტექსტი აუცილებელია'],
        trim: true,
        maxlength: [5000, 'შეტყობინება არ უნდა აღემატებოდეს 5000 სიმბოლოს']
    },
    
    // მედია
    attachments: [{
        name: String,
        url: String,
        type: String,
        size: Number
    }],
    
    // სტატუსი
    isRead: {
        type: Boolean,
        default: false
    },
    
    readAt: Date,
    
    isDeletedBySender: {
        type: Boolean,
        default: false
    },
    
    isDeletedByReceiver: {
        type: Boolean,
        default: false
    },
    
    // ტიპი
    type: {
        type: String,
        enum: ['text', 'offer', 'question', 'complaint', 'other'],
        default: 'text'
    },
    
    // მეტა-ინფორმაცია
    ipAddress: String,
    userAgent: String

}, {
    timestamps: true
});

// ინდექსები
messageSchema.index({ sender: 1 });
messageSchema.index({ receiver: 1 });
messageSchema.index({ job: 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ sender: 1, receiver: 1 });
messageSchema.index({ isRead: 1 });

// მეთოდები
messageSchema.methods.markAsRead = async function() {
    this.isRead = true;
    this.readAt = new Date();
    await this.save();
    return this;
};

messageSchema.methods.deleteForUser = async function(userId) {
    if (this.sender.toString() === userId.toString()) {
        this.isDeletedBySender = true;
    } else if (this.receiver.toString() === userId.toString()) {
        this.isDeletedByReceiver = true;
    }
    
    await this.save();
    return this;
};

messageSchema.statics.getConversation = async function(user1Id, user2Id, page = 1, limit = 50) {
    const query = {
        $or: [
            { sender: user1Id, receiver: user2Id, isDeletedBySender: false },
            { sender: user2Id, receiver: user1Id, isDeletedByReceiver: false }
        ]
    };
    
    const skip = (page - 1) * limit;
    
    const [messages, total] = await Promise.all([
        this.find(query)
            .populate('sender', 'name avatar')
            .populate('receiver', 'name avatar')
            .populate('job', 'title')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit)),
        this.countDocuments(query)
    ]);
    
    // მონიშნეთ როგორც წაკითხული
    await this.updateMany(
        { sender: user2Id, receiver: user1Id, isRead: false },
        { $set: { isRead: true, readAt: new Date() } }
    );
    
    return {
        messages: messages.reverse(), // ძველი ზევით
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
    };
};

const Message = mongoose.model('Message', messageSchema);

module.exports = Message; 
