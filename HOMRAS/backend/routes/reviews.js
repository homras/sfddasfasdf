/**
 * შეფასებების მარშრუტები
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

// Middleware და კონტროლერები
const { authenticate } = require('../middleware/auth');
const { catchAsync } = require('../middleware/error');
const Review = require('../models/Review');
const Job = require('../models/Job');
const User = require('../models/User');

// ვალიდაციის მიდლვეარები
const validateReviewCreate = [
    body('jobId')
        .notEmpty()
        .withMessage('სამუშაოს ID აუცილებელია')
        .isMongoId()
        .withMessage('არასწორი სამუშაოს ID'),
    
    body('rating')
        .isFloat({ min: 1, max: 5 })
        .withMessage('რეიტინგი უნდა იყოს 1-დან 5-მდე'),
    
    body('comment')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('კომენტარი არ უნდა აღემატებოდეს 1000 სიმბოლოს'),
    
    body('categories.professionalism')
        .optional()
        .isFloat({ min: 1, max: 5 })
        .withMessage('პროფესიონალიზმის რეიტინგი უნდა იყოს 1-დან 5-მდე'),
    
    body('categories.quality')
        .optional()
        .isFloat({ min: 1, max: 5 })
        .withMessage('ხარისხის რეიტინგი უნდა იყოს 1-დან 5-მდე'),
    
    body('categories.punctuality')
        .optional()
        .isFloat({ min: 1, max: 5 })
        .withMessage('პუნქტუალურობის რეიტინგი უნდა იყოს 1-დან 5-მდე'),
    
    body('categories.communication')
        .optional()
        .isFloat({ min: 1, max: 5 })
        .withMessage('კომუნიკაციის რეიტინგი უნდა იყოს 1-დან 5-მდე'),
    
    body('categories.price')
        .optional()
        .isFloat({ min: 1, max: 5 })
        .withMessage('ფასის რეიტინგი უნდა იყოს 1-დან 5-მდე')
];

// ახალი შეფასების დამატება
router.post('/', authenticate, validateReviewCreate, catchAsync(async (req, res) => {
    // ვალიდაციის შეცდომების შემოწმება
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    
    const { jobId, rating, comment, categories } = req.body;
    
    // სამუშაოს შემოწმება
    const job = await Job.findById(jobId)
        .populate('customer', 'id')
        .populate('handyman', 'id');
    
    if (!job) {
        return res.status(404).json({
            success: false,
            message: 'სამუშაო ვერ მოიძებნა'
        });
    }
    
    // შემოწმება: დამკვეთია თუ არა
    if (job.customer._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
            success: false,
            message: 'მხოლოდ დამკვეთს შეუძლია შეფასების დატოვება'
        });
    }
    
    // შემოწმება: სამუშაო დასრულებულია თუ არა
    if (job.status !== 'completed') {
        return res.status(400).json({
            success: false,
            message: 'მხოლოდ დასრულებულ სამუშაოზე შეგიძლიათ შეფასების დატოვება'
        });
    }
    
    // შემოწმება: უკვე დატოვა შეფასება
    const existingReview = await Review.findOne({ job: jobId });
    if (existingReview) {
        return res.status(400).json({
            success: false,
            message: 'თქვენ უკვე დატოვეთ შეფასება ამ სამუშაოზე'
        });
    }
    
    // ახალი შეფასების შექმნა
    const review = new Review({
        job: jobId,
        customer: req.user._id,
        handyman: job.handyman._id,
        rating: parseFloat(rating),
        comment: comment || '',
        categories: categories || {}
    });
    
    await review.save();
    
    // სამუშაოზე რეიტინგის დამატება
    job.rating = rating;
    job.review = review._id;
    await job.save();
    
    // ხელოსნის საერთო რეიტინგის განახლება
    await User.findByIdAndUpdate(job.handyman._id, {
        $inc: { totalReviews: 1 }
    });
    
    // ხელოსნის რეიტინგის განახლება
    const handyman = await User.findById(job.handyman._id);
    await handyman.updateRating(parseFloat(rating));
    
    res.status(201).json({
        success: true,
        message: 'შეფასება წარმატებით დაემატა',
        review
    });
}));

// შეფასების მიღება ID-ით
router.get('/:id', catchAsync(async (req, res) => {
    const review = await Review.findById(req.params.id)
        .populate('customer', 'name avatar')
        .populate('handyman', 'name avatar')
        .populate('job', 'title category');
    
    if (!review) {
        return res.status(404).json({
            success: false,
            message: 'შეფასება ვერ მოიძებნა'
        });
    }
    
    res.json({
        success: true,
        review
    });
}));

// შეფასების რედაქტირება
router.put('/:id', authenticate, [
    body('rating')
        .optional()
        .isFloat({ min: 1, max: 5 })
        .withMessage('რეიტინგი უნდა იყოს 1-დან 5-მდე'),
    
    body('comment')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('კომენტარი არ უნდა აღემატებოდეს 1000 სიმბოლოს')
], catchAsync(async (req, res) => {
    // ვალიდაციის შეცდომების შემოწმება
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    
    const review = await Review.findById(req.params.id);
    
    if (!review) {
        return res.status(404).json({
            success: false,
            message: 'შეფასება ვერ მოიძებნა'
        });
    }
    
    // შემოწმება: მომხმარებელი არის შეფასების ავტორი
    if (review.customer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'თქვენ არ გაქვთ ამ შეფასების რედაქტირების უფლება'
        });
    }
    
    const updateData = { ...req.body, isEdited: true };
    
    // რეიტინგის შეცვლის შემთხვევაში, ხელოსნის რეიტინგის განახლება
    if (updateData.rating && updateData.rating !== review.rating) {
        const oldRating = review.rating;
        const newRating = parseFloat(updateData.rating);
        
        // ხელოსნის პოვნა
        const handyman = await User.findById(review.handyman);
        if (handyman) {
            // ძველი რეიტინგის გამოკლება და ახლის დამატება
            const totalScore = (handyman.rating * handyman.totalReviews) - oldRating + newRating;
            handyman.rating = totalScore / handyman.totalReviews;
            handyman.rating = Math.round(handyman.rating * 100) / 100;
            await handyman.save();
        }
    }
    
    const updatedReview = await Review.findByIdAndUpdate(
        req.params.id,
        { $set: updateData },
        { new: true, runValidators: true }
    );
    
    res.json({
        success: true,
        message: 'შეფასება წარმატებით განახლდა',
        review: updatedReview
    });
}));

// შეფასების წაშლა
router.delete('/:id', authenticate, catchAsync(async (req, res) => {
    const review = await Review.findById(req.params.id);
    
    if (!review) {
        return res.status(404).json({
            success: false,
            message: 'შეფასება ვერ მოიძებნა'
        });
    }
    
    // შემოწმება: მომხმარებელი არის შეფასების ავტორი ან ადმინი
    const isAuthor = review.customer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    
    if (!isAuthor && !isAdmin) {
        return res.status(403).json({
            success: false,
            message: 'თქვენ არ გაქვთ ამ შეფასების წაშლის უფლება'
        });
    }
    
    // ხელოსნის რეიტინგის განახლება
    const handyman = await User.findById(review.handyman);
    if (handyman && handyman.totalReviews > 1) {
        // რეიტინგის ხელახალი გამოთვლა
        const totalScore = (handyman.rating * handyman.totalReviews) - review.rating;
        handyman.totalReviews -= 1;
        handyman.rating = handyman.totalReviews > 0 ? totalScore / handyman.totalReviews : 0;
        handyman.rating = Math.round(handyman.rating * 100) / 100;
        await handyman.save();
    } else if (handyman) {
        // ერთი შეფასების წაშლის შემთხვევაში
        handyman.rating = 0;
        handyman.totalReviews = 0;
        await handyman.save();
    }
    
    // სამუშაოდან რეიტინგის წაშლა
    await Job.findByIdAndUpdate(review.job, {
        $unset: { rating: "", review: "" }
    });
    
    // შეფასების წაშლა
    await review.deleteOne();
    
    res.json({
        success: true,
        message: 'შეფასება წარმატებით წაიშალა'
    });
}));

// პასუხის დამატება შეფასებაზე (ხელოსნისთვის)
router.post('/:id/reply', authenticate, [
    body('text')
        .trim()
        .isLength({ min: 1, max: 1000 })
        .withMessage('პასუხი უნდა შეიცავდეს 1-დან 1000 სიმბოლომდე')
], catchAsync(async (req, res) => {
    // ვალიდაციის შეცდომების შემოწმება
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    
    const review = await Review.findById(req.params.id);
    
    if (!review) {
        return res.status(404).json({
            success: false,
            message: 'შეფასება ვერ მოიძებნა'
        });
    }
    
    // შემოწმება: მომხმარებელი არის ხელოსანი, რომელზეც დატოვეს შეფასება
    if (review.handyman.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'მხოლოდ ხელოსანს შეუძლია პასუხის გაცემა'
        });
    }
    
    const { text } = req.body;
    const reply = await review.addReply(text);
    
    res.json({
        success: true,
        message: 'პასუხი წარმატებით დაემატა',
        reply
    });
}));

// შეფასების ლაიქი/დისლაიქი
router.post('/:id/vote', authenticate, [
    body('isHelpful')
        .isBoolean()
        .withMessage('isHelpful უნდა იყოს ბულიანი მნიშვნელობა')
], catchAsync(async (req, res) => {
    // ვალიდაციის შეცდომების შემოწმება
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    
    const review = await Review.findById(req.params.id);
    
    if (!review) {
        return res.status(404).json({
            success: false,
            message: 'შეფასება ვერ მოიძებნა'
        });
    }
    
    // შემოწმება: მომხმარებელი არ არის შეფასების ავტორი
    if (review.customer.toString() === req.user._id.toString()) {
        return res.status(400).json({
            success: false,
            message: 'თქვენ არ შეგიძლიათ საკუთარი შეფასების ხმის მიცემა'
        });
    }
    
    const { isHelpful } = req.body;
    const result = await review.updateHelpful(isHelpful);
    
    res.json({
        success: true,
        message: `შეფასება მონიშნულია როგორც ${isHelpful ? 'სასარგებლო' : 'არასასარგებლო'}`,
        votes: result
    });
}));

// ხელოსნის შეფასებები (ყველა)
router.get('/handyman/:handymanId', catchAsync(async (req, res) => {
    const { page = 1, limit = 10, rating } = req.query;
    const skip = (page - 1) * limit;
    
    // ხელოსნის არსებობის შემოწმება
    const handyman = await User.findOne({
        _id: req.params.handymanId,
        role: 'handyman',
        isActive: true
    });
    
    if (!handyman) {
        return res.status(404).json({
            success: false,
            message: 'ხელოსანი ვერ მოიძებნა'
        });
    }
    
    const query = { handyman: req.params.handymanId };
    if (rating) {
        query.rating = { $gte: parseFloat(rating) };
    }
    
    const [reviews, total] = await Promise.all([
        Review.find(query)
            .populate('customer', 'name avatar')
            .populate('job', 'title category')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit)),
        
        Review.countDocuments(query)
    ]);
    
    // საშუალო რეიტინგი და სტატისტიკა
    const stats = await Review.aggregate([
        { $match: { handyman: handyman._id } },
        {
            $group: {
                _id: null,
                averageRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 },
                fiveStar: {
                    $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] }
                },
                fourStar: {
                    $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] }
                },
                threeStar: {
                    $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] }
                },
                twoStar: {
                    $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] }
                },
                oneStar: {
                    $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] }
                }
            }
        }
    ]);
    
    const ratingStats = stats[0] || {
        averageRating: 0,
        totalReviews: 0,
        fiveStar: 0,
        fourStar: 0,
        threeStar: 0,
        twoStar: 0,
        oneStar: 0
    };
    
    // პროცენტების გამოთვლა
    if (ratingStats.totalReviews > 0) {
        ratingStats.fiveStarPercent = (ratingStats.fiveStar / ratingStats.totalReviews) * 100;
        ratingStats.fourStarPercent = (ratingStats.fourStar / ratingStats.totalReviews) * 100;
        ratingStats.threeStarPercent = (ratingStats.threeStar / ratingStats.totalReviews) * 100;
        ratingStats.twoStarPercent = (ratingStats.twoStar / ratingStats.totalReviews) * 100;
        ratingStats.oneStarPercent = (ratingStats.oneStar / ratingStats.totalReviews) * 100;
    } else {
        ratingStats.fiveStarPercent = 0;
        ratingStats.fourStarPercent = 0;
        ratingStats.threeStarPercent = 0;
        ratingStats.twoStarPercent = 0;
        ratingStats.oneStarPercent = 0;
    }
    
    res.json({
        success: true,
        reviews,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit),
        stats: ratingStats,
        handyman: {
            id: handyman._id,
            name: handyman.name,
            avatar: handyman.avatar,
            rating: handyman.rating,
            totalReviews: handyman.totalReviews
        }
    });
}));

// ჩემი შეფასებები (მიღებული და დატოვებული)
router.get('/user/my-reviews', authenticate, catchAsync(async (req, res) => {
    const { type = 'all', page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    
    let query = {};
    
    if (type === 'given') {
        // დატოვებული შეფასებები
        query.customer = req.user._id;
    } else if (type === 'received' && req.user.role === 'handyman') {
        // მიღებული შეფასებები (ხელოსნებისთვის)
        query.handyman = req.user._id;
    } else {
        // ყველა შეფასება
        query = {
            $or: [
                { customer: req.user._id },
                { handyman: req.user._id }
            ]
        };
    }
    
    const [reviews, total] = await Promise.all([
        Review.find(query)
            .populate('customer', 'name avatar')
            .populate('handyman', 'name avatar')
            .populate('job', 'title category')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit)),
        
        Review.countDocuments(query)
    ]);
    
    res.json({
        success: true,
        reviews,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit),
        type
    });
}));

module.exports = router; 
