/**
 * სამუშაოების კონტროლერი
 */

const Job = require('../models/Job');
const User = require('../models/User');
const Review = require('../models/Review');
const { AppError, catchAsync } = require('../middleware/error');

class JobController {
    /**
     * ყველა სამუშაოს მიღება (ფილტრებით)
     */
    static getAllJobs = catchAsync(async (req, res, next) => {
        const {
            category,
            city,
            status = 'open',
            minBudget,
            maxBudget,
            search,
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            customerId,
            handymanId,
            nearLocation
        } = req.query;

        const filters = {
            category: category === 'all' ? undefined : category,
            city: city === 'all' ? undefined : city,
            status: status === 'all' ? undefined : status,
            minBudget: minBudget ? parseFloat(minBudget) : undefined,
            maxBudget: maxBudget ? parseFloat(maxBudget) : undefined,
            search,
            page: parseInt(page),
            limit: parseInt(limit),
            sortBy,
            sortOrder,
            customerId,
            handymanId
        };

        // მდებარეობის მიხედვით ფილტრაცია
        if (nearLocation) {
            try {
                const [lat, lng, radius = 10] = nearLocation.split(',').map(Number);
                filters.nearLocation = { lat, lng, radius };
            } catch (error) {
                return next(new AppError('არასწორი მდებარეობის ფორმატი', 400));
            }
        }

        const jobs = await Job.findByFilters(filters);

        res.json({
            success: true,
            ...jobs
        });
    });

    /**
     * ახალი სამუშაოს შექმნა
     */
    static createJob = catchAsync(async (req, res, next) => {
        const {
            title,
            description,
            category,
            city,
            address,
            budget,
            budgetType = 'negotiable',
            deadline,
            estimatedDuration,
            requirements,
            specialInstructions,
            photos = []
        } = req.body;

        // მომხმარებლის ვალიდაცია
        if (req.user.role !== 'customer' && req.user.role !== 'admin') {
            return next(new AppError('მხოლოდ დამკვეთებს შეუძლიათ სამუშაოს გამოქვეყნება', 403));
        }

        // ახალი სამუშაოს შექმნა
        const job = new Job({
            title,
            description,
            category,
            city,
            address,
            budget: budget ? parseFloat(budget) : undefined,
            budgetType,
            deadline: deadline ? new Date(deadline) : undefined,
            estimatedDuration: estimatedDuration ? parseInt(estimatedDuration) : undefined,
            customer: req.user._id,
            customerName: req.user.name,
            customerPhone: req.user.phone,
            photos: Array.isArray(photos) ? photos : [],
            requirements: requirements ? JSON.parse(requirements) : [],
            specialInstructions,
            tags: [category, city, req.user.city].filter(Boolean),
            publishedAt: new Date()
        });

        // მდებარეობის კოორდინატები (თუ მოწოდებულია)
        if (req.body.latitude && req.body.longitude) {
            job.location = {
                type: 'Point',
                coordinates: [
                    parseFloat(req.body.longitude),
                    parseFloat(req.body.latitude)
                ]
            };
        }

        await job.save();

        // მომხმარებლის სტატისტიკის განახლება
        await User.findByIdAndUpdate(req.user._id, {
            $inc: { jobCount: 1 }
        });

        res.status(201).json({
            success: true,
            message: 'სამუშაო წარმატებით გამოქვეყნდა',
            job
        });
    });

    /**
     * კონკრეტული სამუშაოს დეტალები
     */
    static getJobById = catchAsync(async (req, res, next) => {
        const job = await Job.findById(req.params.id)
            .populate('customer', 'name avatar phone rating completedJobs isVerified')
            .populate('handyman', 'name avatar phone rating skills experience bio')
            .populate('applications.handyman', 'name avatar rating skills experience')
            .populate('review');

        if (!job) {
            return next(new AppError('სამუშაო ვერ მოიძებნა', 404));
        }

        // ნახვების რაოდენობის გაზრდა
        job.views += 1;
        await job.save();

        // შეფასება (თუ არსებობს)
        let review = null;
        if (job.review) {
            review = await Review.findById(job.review)
                .populate('customer', 'name avatar')
                .populate('handyman', 'name avatar');
        }

        // მსგავსი სამუშაოები
        const similarJobs = await Job.find({
            category: job.category,
            city: job.city,
            status: 'open',
            _id: { $ne: job._id }
        })
        .limit(4)
        .select('title category city budget createdAt')
        .sort({ createdAt: -1 });

        res.json({
            success: true,
            job: {
                ...job.toObject(),
                review,
                similarJobs
            }
        });
    });

    /**
     * სამუშაოს რედაქტირება
     */
    static updateJob = catchAsync(async (req, res, next) => {
        const job = await Job.findById(req.params.id);

        if (!job) {
            return next(new AppError('სამუშაო ვერ მოიძებნა', 404));
        }

        // პერმისიების შემოწმება
        const isOwner = job.customer.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';
        
        if (!isOwner && !isAdmin) {
            return next(new AppError('თქვენ არ გაქვთ ამ სამუშაოს რედაქტირების უფლება', 403));
        }

        // განახლება
        const updateData = { ...req.body };

        // სტატუსის ცვლილების დამუშავება
        if (updateData.status && updateData.status !== job.status) {
            await this.handleStatusChange(job, updateData.status, req.user);
        }

        // ფოტოების დამუშავება
        if (updateData.photos && Array.isArray(updateData.photos)) {
            updateData.photos = updateData.photos;
        }

        // ფაილების ატვირთვა (თუ არსებობს)
        if (req.files && req.files.length > 0) {
            const newPhotos = req.files.map(file => `/uploads/${file.filename}`);
            updateData.photos = [...(job.photos || []), ...newPhotos];
        }

        const updatedJob = await Job.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        res.json({
            success: true,
            message: 'სამუშაო წარმატებით განახლდა',
            job: updatedJob
        });
    });

    /**
     * სამუშაოს წაშლა
     */
    static deleteJob = catchAsync(async (req, res, next) => {
        const job = await Job.findById(req.params.id);

        if (!job) {
            return next(new AppError('სამუშაო ვერ მოიძებნა', 404));
        }

        // პერმისიების შემოწმება
        const isOwner = job.customer.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';
        
        if (!isOwner && !isAdmin) {
            return next(new AppError('თქვენ არ გაქვთ ამ სამუშაოს წაშლის უფლება', 403));
        }

        // შეფასების წაშლა (თუ არსებობს)
        if (job.review) {
            await Review.findByIdAndDelete(job.review);
        }

        // წაშლა
        await job.deleteOne();

        res.json({
            success: true,
            message: 'სამუშაო წარმატებით წაიშალა'
        });
    });

    /**
     * სამუშაოზე განცხადება
     */
    static applyForJob = catchAsync(async (req, res, next) => {
        const job = await Job.findById(req.params.id);

        if (!job) {
            return next(new AppError('სამუშაო ვერ მოიძებნა', 404));
        }

        // შემოწმება: მხოლოდ ხელოსნებს შეუძლიათ განცხადება
        if (req.user.role !== 'handyman' && req.user.role !== 'admin') {
            return next(new AppError('მხოლოდ ხელოსნებს შეუძლიათ სამუშაოზე განცხადება', 403));
        }

        // შემოწმება: სამუშაო ღიაა თუ არა
        if (job.status !== 'open') {
            return next(new AppError('ამ სამუშაოზე განცხადება აღარ შეგიძლიათ', 400));
        }

        // შემოწმება: უკვე განაცხადა თუ არა
        const hasApplied = job.applications.some(app => 
            app.handyman && app.handyman.toString() === req.user._id.toString()
        );

        if (hasApplied) {
            return next(new AppError('თქვენ უკვე განაცხადეთ ამ სამუშაოზე', 400));
        }

        const { proposal, bidAmount, estimatedTime } = req.body;

        // განაცხადის დამატება
        const application = await job.applyForJob(
            req.user._id,
            proposal,
            bidAmount ? parseFloat(bidAmount) : undefined,
            estimatedTime ? parseInt(estimatedTime) : undefined
        );

        // ხელოსნის სახელის და ავატარის დამატება
        application.handymanName = req.user.name;
        application.handymanAvatar = req.user.avatar;
        await job.save();

        // TODO: დამკვეთთან შეტყობინების გაგზავნა

        res.status(201).json({
            success: true,
            message: 'განცხადება წარმატებით გაიგზავნა',
            application
        });
    });

    /**
     * განცხადების მიღება
     */
    static acceptApplication = catchAsync(async (req, res, next) => {
        const job = await Job.findById(req.params.id);

        if (!job) {
            return next(new AppError('სამუშაო ვერ მოიძებნა', 404));
        }

        // შემოწმება: დამკვეთია თუ არა
        if (job.customer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return next(new AppError('მხოლოდ დამკვეთს შეუძლია განცხადების მიღება', 403));
        }

        // განცხადების მიღება
        const application = await job.acceptApplication(req.params.applicationId);

        // ხელოსნის ინფორმაციის დამატება
        const handyman = await User.findById(application.handyman);
        if (handyman) {
            job.handymanName = handyman.name;
            job.handymanPhone = handyman.phone;
            await job.save();
        }

        // TODO: ხელოსანთან შეტყობინების გაგზავნა

        res.json({
            success: true,
            message: 'ხელოსანი წარმატებით დაინიშნა',
            job,
            application
        });
    });

    /**
     * ჩემი სამუშაოები (დამკვეთისთვის)
     */
    static getMyJobs = catchAsync(async (req, res, next) => {
        const { status, page = 1, limit = 10 } = req.query;

        const query = { customer: req.user._id };
        if (status && status !== 'all') {
            query.status = status;
        }

        const skip = (page - 1) * limit;

        const [jobs, total] = await Promise.all([
            Job.find(query)
                .populate('handyman', 'name avatar phone rating')
                .populate('applications.handyman', 'name avatar rating')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Job.countDocuments(query)
        ]);

        res.json({
            success: true,
            jobs,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            limit: parseInt(limit)
        });
    });

    /**
     * ჩემი განცხადებები (ხელოსნისთვის)
     */
    static getMyApplications = catchAsync(async (req, res, next) => {
        const { status, page = 1, limit = 10 } = req.query;

        const query = { 
            'applications.handyman': req.user._id 
        };

        if (status && status !== 'all') {
            if (status === 'accepted') {
                query.handyman = req.user._id;
            } else if (status === 'pending') {
                query['applications.status'] = 'pending';
                query['applications.handyman'] = req.user._id;
            } else if (status === 'rejected') {
                query['applications.status'] = 'rejected';
                query['applications.handyman'] = req.user._id;
            }
        }

        const skip = (page - 1) * limit;

        const [jobs, total] = await Promise.all([
            Job.find(query)
                .populate('customer', 'name avatar phone rating')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Job.countDocuments(query)
        ]);

        res.json({
            success: true,
            jobs,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            limit: parseInt(limit)
        });
    });

    /**
     * სამუშაოს დასრულება
     */
    static completeJob = catchAsync(async (req, res, next) => {
        const job = await Job.findById(req.params.id);

        if (!job) {
            return next(new AppError('სამუშაო ვერ მოიძებნა', 404));
        }

        // შემოწმება: დამკვეთი ან მინიჭებული ხელოსანი
        const isCustomer = job.customer.toString() === req.user._id.toString();
        const isHandyman = job.handyman && job.handyman.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';

        if (!isCustomer && !isHandyman && !isAdmin) {
            return next(new AppError('თქვენ არ გაქვთ ამ მოქმედების უფლება', 403));
        }

        // სტატუსის განახლება
        job.status = 'completed';
        job.completedAt = new Date();
        await job.save();

        // ხელოსნის სტატისტიკის განახლება
        if (job.handyman) {
            await User.findByIdAndUpdate(job.handyman, {
                $inc: { completedJobs: 1 }
            });
        }

        res.json({
            success: true,
            message: 'სამუშაო მონიშნულია როგორც დასრულებული',
            job
        });
    });

    /**
     * სამუშაოს გაუქმება
     */
    static cancelJob = catchAsync(async (req, res, next) => {
        const job = await Job.findById(req.params.id);

        if (!job) {
            return next(new AppError('სამუშაო ვერ მოიძებნა', 404));
        }

        // შემოწმება: დამკვეთია თუ არა
        if (job.customer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return next(new AppError('მხოლოდ დამკვეთს შეუძლია სამუშაოს გაუქმება', 403));
        }

        // შემოწმება: უკვე დაწყებულია თუ არა
        if (job.status === 'in_progress' || job.status === 'completed') {
            return next(new AppError('დაწყებული სამუშაოს გაუქმება არ შეიძლება', 400));
        }

        // სტატუსის განახლება
        job.status = 'cancelled';
        job.cancelledAt = new Date();
        await job.save();

        // TODO: ყველა მსურველ ხელოსანთან შეტყობინების გაგზავნა

        res.json({
            success: true,
            message: 'სამუშაო წარმატებით გაუქმდა',
            job
        });
    });

    /**
     * სამუშაოს ხელმისაწვდომობის შემოწმება
     */
    static checkJobAvailability = catchAsync(async (req, res, next) => {
        const job = await Job.findById(req.params.id);

        if (!job) {
            return next(new AppError('სამუშაო ვერ მოიძებნა', 404));
        }

        const isAvailable = job.status === 'open';
        const canApply = isAvailable && req.user.role === 'handyman';

        // შემოწმება: უკვე განაცხადა თუ არა
        let hasApplied = false;
        if (req.user.role === 'handyman') {
            hasApplied = job.applications.some(app => 
                app.handyman && app.handyman.toString() === req.user._id.toString()
            );
        }

        res.json({
            success: true,
            isAvailable,
            canApply: canApply && !hasApplied,
            hasApplied,
            status: job.status,
            applicationCount: job.applicationCount
        });
    });

    /**
     * სამუშაოს ფოტოების დამატება
     */
    static addJobPhotos = catchAsync(async (req, res, next) => {
        const job = await Job.findById(req.params.id);

        if (!job) {
            return next(new AppError('სამუშაო ვერ მოიძებნა', 404));
        }

        // პერმისიების შემოწმება
        const isOwner = job.customer.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';
        
        if (!isOwner && !isAdmin) {
            return next(new AppError('თქვენ არ გაქვთ ამ სამუშაოს რედაქტირების უფლება', 403));
        }

        if (!req.files || req.files.length === 0) {
            return next(new AppError('გთხოვთ ატვირთოთ მინიმუმ ერთი ფოტო', 400));
        }

        // ახალი ფოტოების დამატება
        const newPhotos = req.files.map(file => `/uploads/${file.filename}`);
        job.photos = [...(job.photos || []), ...newPhotos];
        await job.save();

        res.json({
            success: true,
            message: 'ფოტოები წარმატებით დაემატა',
            photos: job.photos
        });
    });

    /**
     * დამხმარე მეთოდები
     */

    // სტატუსის ცვლილების დამუშავება
    static async handleStatusChange(job, newStatus, user) {
        switch (newStatus) {
            case 'in_progress':
                job.startedAt = new Date();
                // TODO: ხელოსნის შეტყობინება
                break;
                
            case 'completed':
                job.completedAt = new Date();
                // TODO: ორივე მხარის შეტყობინება
                break;
                
            case 'cancelled':
                job.cancelledAt = new Date();
                // TODO: ხელოსნების შეტყობინება
                break;
                
            case 'closed':
                // TODO: შეფასების მოთხოვნა
                break;
        }
    }

    // სამუშაოს ძებნა მდებარეობის მიხედვით
    static async searchJobsByLocation(lat, lng, radius = 10) {
        const jobs = await Job.find({
            status: 'open',
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [lng, lat]
                    },
                    $maxDistance: radius * 1000 // კილომეტრებში
                }
            }
        })
        .limit(50)
        .select('title category city address budget createdAt')
        .sort({ createdAt: -1 });

        return jobs;
    }

    // სამუშაოს სტატისტიკა
    static async getJobStats(userId, role) {
        const matchStage = {};
        
        if (role === 'customer') {
            matchStage.customer = userId;
        } else if (role === 'handyman') {
            matchStage.handyman = userId;
        }

        const stats = await Job.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalBudget: { $sum: '$budget' },
                    avgBudget: { $avg: '$budget' }
                }
            },
            {
                $project: {
                    status: '$_id',
                    count: 1,
                    totalBudget: { $ifNull: ['$totalBudget', 0] },
                    avgBudget: { $ifNull: ['$avgBudget', 0] },
                    _id: 0
                }
            }
        ]);

        return stats;
    }
}

module.exports = JobController;