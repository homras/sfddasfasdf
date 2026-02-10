/**
 * მომხმარებლების კონტროლერი
 */

const User = require('../models/User');
const HandymanProfile = require('../models/HandymanProfile');
const Job = require('../models/Job');
const Review = require('../models/Review');
const { AppError, catchAsync } = require('../middleware/error');

class UserController {
    /**
     * მიმდინარე მომხმარებლის პროფილი
     */
    static getMyProfile = catchAsync(async (req, res, next) => {
        const user = await User.findById(req.user._id);

        if (!user) {
            return next(new AppError('მომხმარებელი ვერ მოიძებნა', 404));
        }

        // ხელოსნისთვის დამატებითი ინფორმაცია
        let handymanProfile = null;
        let detailedStats = null;

        if (user.role === 'handyman') {
            handymanProfile = await HandymanProfile.findOne({ user: user._id });
            detailedStats = await this.getHandymanDetailedStats(user._id);
        }

        // ძირითადი სტატისტიკა
        const stats = await this.getUserStats(user._id, user.role);

        res.json({
            success: true,
            user: user.toSafeObject(),
            handymanProfile,
            stats,
            detailedStats
        });
    });

    /**
     * პროფილის განახლება
     */
    static updateProfile = catchAsync(async (req, res, next) => {
        const updateData = { ...req.body };

        // ავატარის დამუშავება
        if (req.file) {
            updateData.avatar = `/uploads/${req.file.filename}`;
        }

        // ტელეფონის უნიკალურობის შემოწმება
        if (updateData.phone && updateData.phone !== req.user.phone) {
            const existingPhone = await User.findOne({ 
                phone: updateData.phone,
                _id: { $ne: req.user._id }
            });
            
            if (existingPhone) {
                return next(new AppError('ეს ტელეფონის ნომერი უკვე გამოყენებულია', 400));
            }
        }

        // პრეფერენციების დამუშავება
        if (updateData.preferences) {
            if (typeof updateData.preferences === 'string') {
                try {
                    updateData.preferences = JSON.parse(updateData.preferences);
                } catch (error) {
                    return next(new AppError('არასწორი პრეფერენციების ფორმატი', 400));
                }
            }
        }

        // განახლება
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        // ხელოსნის პროფილის განახლება/შექმნა
        if (user.role === 'handyman') {
            await this.updateOrCreateHandymanProfile(user, updateData);
        }

        res.json({
            success: true,
            message: 'პროფილი წარმატებით განახლდა',
            user: user.toSafeObject()
        });
    });

    /**
     * ხელოსნების სია
     */
    static getHandymen = catchAsync(async (req, res, next) => {
        const {
            city,
            skills,
            minRating,
            maxHourlyRate,
            availability,
            page = 1,
            limit = 10,
            sortBy = 'rating',
            sortOrder = 'desc',
            search,
            serviceArea,
            experienceMin,
            experienceMax
        } = req.query;

        const filters = {
            city: city === 'all' ? undefined : city,
            skills: skills ? skills.split(',') : undefined,
            minRating: minRating ? parseFloat(minRating) : undefined,
            maxHourlyRate: maxHourlyRate ? parseFloat(maxHourlyRate) : undefined,
            availability: availability === 'all' ? undefined : availability,
            page: parseInt(page),
            limit: parseInt(limit),
            sortBy,
            sortOrder,
            search
        };

        // გამოცდილების ფილტრი
        if (experienceMin || experienceMax) {
            filters.experience = {};
            if (experienceMin) filters.experience.$gte = parseInt(experienceMin);
            if (experienceMax) filters.experience.$lte = parseInt(experienceMax);
        }

        const handymen = await User.findHandymen(filters);

        // დამატებითი ინფორმაციის მიღება
        const enhancedHandymen = await Promise.all(
            handymen.users.map(async (handyman) => {
                const handymanProfile = await HandymanProfile.findOne({ user: handyman._id });
                
                // სერვისის არეალის შემოწმება (თუ მითითებულია)
                if (serviceArea && handymanProfile) {
                    const hasServiceArea = handymanProfile.serviceAreas?.includes(serviceArea);
                    if (!hasServiceArea) return null;
                }

                // შეფასებები
                const recentReviews = await Review.find({ handyman: handyman._id })
                    .limit(2)
                    .populate('customer', 'name avatar')
                    .sort({ createdAt: -1 });

                // რეიტინგის დისტრიბუცია
                const ratingDistribution = await Review.aggregate([
                    { $match: { handyman: handyman._id } },
                    {
                        $group: {
                            _id: '$rating',
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { _id: -1 } }
                ]);

                return {
                    ...handyman.toObject(),
                    recentReviews,
                    ratingDistribution,
                    profileDetails: handymanProfile ? {
                        companyName: handymanProfile.companyName,
                        serviceAreas: handymanProfile.serviceAreas,
                        workingHours: handymanProfile.workingHours,
                        responseTime: handymanProfile.responseTime,
                        completionRate: handymanProfile.completionRate,
                        isFeatured: handymanProfile.isFeatured
                    } : null
                };
            })
        );

        // null მნიშვნელობების ფილტრაცია
        const filteredHandymen = enhancedHandymen.filter(h => h !== null);

        res.json({
            success: true,
            handymen: filteredHandymen,
            total: handymen.total,
            page: handymen.page,
            pages: Math.ceil(handymen.total / limit),
            limit: handymen.limit
        });
    });

    /**
     * კონკრეტული ხელოსნის პროფილი
     */
    static getHandymanProfile = catchAsync(async (req, res, next) => {
        const handyman = await User.findOne({
            _id: req.params.id,
            role: 'handyman',
            isActive: true
        });

        if (!handyman) {
            return next(new AppError('ხელოსანი ვერ მოიძებნა', 404));
        }

        const handymanProfile = await HandymanProfile.findOne({ user: handyman._id });

        // შეფასებები
        const reviews = await Review.find({ handyman: handyman._id })
            .populate('customer', 'name avatar')
            .populate('job', 'title category')
            .sort({ createdAt: -1 })
            .limit(10);

        // კატეგორიული რეიტინგები
        const categoryRatings = await Review.aggregate([
            { $match: { handyman: handyman._id } },
            {
                $group: {
                    _id: null,
                    professionalism: { $avg: '$categories.professionalism' },
                    quality: { $avg: '$categories.quality' },
                    punctuality: { $avg: '$categories.punctuality' },
                    communication: { $avg: '$categories.communication' },
                    price: { $avg: '$categories.price' }
                }
            }
        ]);

        // დასრულებული სამუშაოები
        const completedJobs = await Job.find({
            handyman: handyman._id,
            status: 'completed'
        })
        .select('title category budget completedAt customerReview')
        .populate('customer', 'name avatar')
        .sort({ completedAt: -1 })
        .limit(5);

        // პორტფოლიო (თუ არსებობს)
        const portfolio = handymanProfile?.portfolio || [];

        // სტატისტიკა
        const stats = await this.getHandymanDetailedStats(handyman._id);

        res.json({
            success: true,
            handyman: handyman.toSafeObject(),
            profile: handymanProfile,
            reviews,
            categoryRatings: categoryRatings[0] || {},
            completedJobs,
            portfolio,
            stats
        });
    });

    /**
     * მომხმარებლის შეფასებები
     */
    static getUserReviews = catchAsync(async (req, res, next) => {
        const user = await User.findById(req.params.id);

        if (!user) {
            return next(new AppError('მომხმარებელი ვერ მოიძებნა', 404));
        }

        const { page = 1, limit = 10, type = 'all' } = req.query;
        const skip = (page - 1) * limit;

        let query = {};
        
        if (type === 'given') {
            query.customer = user._id;
        } else if (type === 'received' && user.role === 'handyman') {
            query.handyman = user._id;
        } else {
            query = {
                $or: [
                    { customer: user._id },
                    { handyman: user._id }
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

        // საშუალო რეიტინგი
        const avgRating = await Review.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: '$rating' }
                }
            }
        ]);

        res.json({
            success: true,
            reviews,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            limit: parseInt(limit),
            averageRating: avgRating[0]?.averageRating || 0,
            user: {
                id: user._id,
                name: user.name,
                role: user.role,
                avatar: user.avatar
            }
        });
    });

    /**
     * ხელოსნის ხელმისაწვდომობის განახლება
     */
    static updateAvailability = catchAsync(async (req, res, next) => {
        const { availability } = req.body;

        // შემოწმება: ხელოსანია თუ არა
        if (req.user.role !== 'handyman' && req.user.role !== 'admin') {
            return next(new AppError('მხოლოდ ხელოსნებს შეუძლიათ ხელმისაწვდომობის განახლება', 403));
        }

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $set: { availability } },
            { new: true }
        );

        res.json({
            success: true,
            message: 'ხელმისაწვდომობა წარმატებით განახლდა',
            availability: user.availability
        });
    });

    /**
     * მომხმარებლის დეაქტივაცია
     */
    static deactivateAccount = catchAsync(async (req, res, next) => {
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $set: { isActive: false } },
            { new: true }
        );

        // TODO: ყველა აქტიური სამუშაოს გაუქმება/შეჩერება

        res.json({
            success: true,
            message: 'თქვენი ანგარიში დეაქტივირებულია',
            user: user.toSafeObject()
        });
    });

    /**
     * მომხმარებლის აქტივაცია
     */
    static activateAccount = catchAsync(async (req, res, next) => {
        const { email, password } = req.body;

        // მომხმარებლის პოვნა
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

        if (!user) {
            return next(new AppError('მომხმარებელი ვერ მოიძებნა', 404));
        }

        // პაროლის შემოწმება
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return next(new AppError('არასწორი პაროლი', 401));
        }

        // აქტივაცია
        user.isActive = true;
        await user.save();

        // ტოკენის გენერირება
        const token = require('../middleware/auth').generateToken(user._id, user.role);

        res.json({
            success: true,
            message: 'თქვენი ანგარიში გააქტიურდა',
            user: user.toSafeObject(),
            token
        });
    });

    /**
     * ხელოსნის ვერიფიკაციის მოთხოვნა
     */
    static requestVerification = catchAsync(async (req, res, next) => {
        if (req.user.role !== 'handyman') {
            return next(new AppError('მხოლოდ ხელოსნებს შეუძლიათ ვერიფიკაციის მოთხოვნა', 403));
        }

        const { documents } = req.body;

        if (!documents || !Array.isArray(documents) || documents.length === 0) {
            return next(new AppError('გთხოვთ მიაწოდოთ დოკუმენტები ვერიფიკაციისთვის', 400));
        }

        const handymanProfile = await HandymanProfile.findOneAndUpdate(
            { user: req.user._id },
            { 
                $set: { 
                    certificates: documents.map(doc => ({
                        name: doc.name,
                        url: doc.url,
                        verified: false
                    }))
                } 
            },
            { new: true, upsert: true }
        );

        // TODO: ადმინისტრატორთან შეტყობინების გაგზავნა

        res.json({
            success: true,
            message: 'ვერიფიკაციის მოთხოვნა გაგზავნილია. განხილვა დასრულდება 1-3 სამუშაო დღეში.',
            profile: handymanProfile
        });
    });

    /**
     * ხელოსნის რეიტინგის განახლება
     */
    static updateRating = catchAsync(async (req, res, next) => {
        const { handymanId } = req.params;
        const { rating, reviewId } = req.body;

        const handyman = await User.findById(handymanId);

        if (!handyman || handyman.role !== 'handyman') {
            return next(new AppError('ხელოსანი ვერ მოიძებნა', 404));
        }

        // შემოწმება: დამკვეთია თუ არა
        const review = await Review.findById(reviewId);
        if (!review || review.customer.toString() !== req.user._id.toString()) {
            return next(new AppError('მხოლოდ დამკვეთს შეუძლია ხელოსნის რეიტინგის განახლება', 403));
        }

        // რეიტინგის განახლება
        const newAverageRating = await handyman.updateRating(rating);

        res.json({
            success: true,
            message: 'რეიტინგი წარმატებით განახლდა',
            newRating: newAverageRating
        });
    });

    /**
     * დამხმარე მეთოდები
     */

    // ხელოსნის პროფილის განახლება ან შექმნა
    static async updateOrCreateHandymanProfile(user, updateData) {
        let handymanProfile = await HandymanProfile.findOne({ user: user._id });

        const profileData = {
            skills: updateData.skills || user.skills,
            experience: updateData.experience || user.experience,
            bio: updateData.bio || user.bio,
            hourlyRate: updateData.hourlyRate || user.hourlyRate,
            languages: updateData.languages || user.languages,
            availability: updateData.availability || user.availability,
            city: updateData.city || user.city,
            address: updateData.address || user.address
        };

        if (handymanProfile) {
            handymanProfile = await HandymanProfile.findByIdAndUpdate(
                handymanProfile._id,
                { $set: profileData },
                { new: true }
            );
        } else {
            handymanProfile = new HandymanProfile({
                user: user._id,
                ...profileData,
                serviceAreas: [user.city],
                workingHours: {
                    monday: { from: '09:00', to: '18:00', available: true },
                    tuesday: { from: '09:00', to: '18:00', available: true },
                    wednesday: { from: '09:00', to: '18:00', available: true },
                    thursday: { from: '09:00', to: '18:00', available: true },
                    friday: { from: '09:00', to: '18:00', available: true },
                    saturday: { from: '10:00', to: '16:00', available: true },
                    sunday: { from: '10:00', to: '14:00', available: false }
                },
                responseTime: 24,
                completionRate: 0,
                onTimeRate: 0,
                repeatClients: 0
            });
            await handymanProfile.save();
        }

        return handymanProfile;
    }

    // მომხმარებლის სტატისტიკა
    static async getUserStats(userId, role) {
        let stats = {};

        if (role === 'customer') {
            stats = await Job.aggregate([
                { $match: { customer: userId } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalBudget: { $sum: '$budget' }
                    }
                }
            ]);
        } else if (role === 'handyman') {
            stats = await Job.aggregate([
                { $match: { handyman: userId } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalEarnings: { $sum: '$budget' }
                    }
                }
            ]);
        }

        return stats.reduce((acc, stat) => {
            acc[stat._id] = {
                count: stat.count,
                total: stat.totalBudget || stat.totalEarnings || 0
            };
            return acc;
        }, {});
    }

    // ხელოსნის დეტალური სტატისტიკა
    static async getHandymanDetailedStats(handymanId) {
        const [
            jobStats,
            reviewStats,
            monthlyStats
        ] = await Promise.all([
            // სამუშაო სტატისტიკა
            Job.aggregate([
                { $match: { handyman: handymanId } },
                {
                    $group: {
                        _id: null,
                        totalJobs: { $sum: 1 },
                        completedJobs: {
                            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                        },
                        inProgressJobs: {
                            $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
                        },
                        cancelledJobs: {
                            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
                        },
                        totalEarnings: { $sum: '$budget' },
                        avgEarningsPerJob: { $avg: '$budget' }
                    }
                }
            ]),

            // შეფასებების სტატისტიკა
            Review.aggregate([
                { $match: { handyman: handymanId } },
                {
                    $group: {
                        _id: null,
                        totalReviews: { $sum: 1 },
                        avgRating: { $avg: '$rating' },
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
            ]),

            // ყოველთვიური სტატისტიკა
            Job.aggregate([
                { 
                    $match: { 
                        handyman: handymanId,
                        status: 'completed',
                        completedAt: { $exists: true }
                    } 
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$completedAt' },
                            month: { $month: '$completedAt' }
                        },
                        jobs: { $sum: 1 },
                        earnings: { $sum: '$budget' }
                    }
                },
                { $sort: { '_id.year': -1, '_id.month': -1 } },
                { $limit: 6 }
            ])
        ]);

        const handymanProfile = await HandymanProfile.findOne({ user: handymanId });

        return {
            jobStats: jobStats[0] || {
                totalJobs: 0,
                completedJobs: 0,
                inProgressJobs: 0,
                cancelledJobs: 0,
                totalEarnings: 0,
                avgEarningsPerJob: 0
            },
            reviewStats: reviewStats[0] || {
                totalReviews: 0,
                avgRating: 0,
                fiveStar: 0,
                fourStar: 0,
                threeStar: 0,
                twoStar: 0,
                oneStar: 0
            },
            monthlyStats,
            profileStats: handymanProfile ? {
                responseTime: handymanProfile.responseTime,
                completionRate: handymanProfile.completionRate,
                onTimeRate: handymanProfile.onTimeRate,
                repeatClients: handymanProfile.repeatClients
            } : null
        };
    }

    // ხელოსნების რეკომენდაცია
    static async getRecommendedHandymen(userId, limit = 5) {
        const user = await User.findById(userId);
        
        if (!user) return [];

        // მსგავსი ხელოსნების ძებნა იმავე ქალაქში და კატეგორიაში
        const recommended = await User.find({
            role: 'handyman',
            isActive: true,
            city: user.city,
            _id: { $ne: userId },
            rating: { $gte: 4 }
        })
        .select('name avatar rating skills experience hourlyRate')
        .sort({ rating: -1, completedJobs: -1 })
        .limit(limit);

        return recommended;
    }

    // მომხმარებლის აქტივობის ისტორია
    static async getUserActivity(userId, limit = 20) {
        const [
            jobs,
            reviews,
            applications
        ] = await Promise.all([
            // სამუშაოები
            Job.find({
                $or: [
                    { customer: userId },
                    { handyman: userId }
                ]
            })
            .select('title status budget createdAt updatedAt')
            .sort({ updatedAt: -1 })
            .limit(limit),

            // შეფასებები
            Review.find({
                $or: [
                    { customer: userId },
                    { handyman: userId }
                ]
            })
            .select('rating comment createdAt')
            .populate('customer', 'name avatar')
            .populate('handyman', 'name avatar')
            .sort({ createdAt: -1 })
            .limit(limit),

            // განცხადებები
            Job.find({
                'applications.handyman': userId
            })
            .select('title status budget applications')
            .sort({ updatedAt: -1 })
            .limit(limit)
        ]);

        // აქტივობის გაერთიანება
        const activities = [
            ...jobs.map(job => ({
                type: 'job',
                action: job.handyman?.toString() === userId ? 'assigned' : 'created',
                data: job,
                date: job.updatedAt
            })),
            ...reviews.map(review => ({
                type: 'review',
                action: review.customer._id.toString() === userId ? 'given' : 'received',
                data: review,
                date: review.createdAt
            })),
            ...applications.map(job => ({
                type: 'application',
                action: 'applied',
                data: job,
                date: job.updatedAt
            }))
        ];

        // დალაგება თარიღის მიხედვით
        activities.sort((a, b) => b.date - a.date);

        return activities.slice(0, limit);
    }
}

module.exports = UserController; 
