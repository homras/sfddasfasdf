/**
 * ავთენტიფიკაციის კონტროლერი
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { AppError, catchAsync } = require('../middleware/error');

class AuthController {
    /**
     * რეგისტრაცია
     */
    static register = catchAsync(async (req, res, next) => {
        const { name, email, phone, password, role = 'customer', city = 'batumi' } = req.body;

        // ელ.ფოსტის უნიკალურობის შემოწმება
        const existingEmail = await User.findOne({ email: email.toLowerCase() });
        if (existingEmail) {
            return next(new AppError('ეს ელ.ფოსტა უკვე რეგისტრირებულია', 400));
        }

        // ტელეფონის ნომრის უნიკალურობის შემოწმება
        const existingPhone = await User.findOne({ phone });
        if (existingPhone) {
            return next(new AppError('ეს ტელეფონის ნომერი უკვე რეგისტრირებულია', 400));
        }

        // ვერიფიკაციის ტოკენის გენერირება
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationTokenHash = crypto
            .createHash('sha256')
            .update(verificationToken)
            .digest('hex');

        // ახალი მომხმარებლის შექმნა
        const user = new User({
            name,
            email: email.toLowerCase(),
            phone,
            password,
            role,
            city,
            verificationToken: verificationTokenHash,
            verificationExpires: Date.now() + 24 * 60 * 60 * 1000, // 24 საათი
            preferences: {
                language: 'ka',
                currency: 'GEL',
                notifications: {
                    email: true,
                    sms: true,
                    push: true
                }
            }
        });

        await user.save();

        // ვერიფიკაციის ელ.ფოსტის გაგზავნა (თუ დაყენებულია)
        if (process.env.SEND_EMAIL === 'true') {
            await this.sendVerificationEmail(user, verificationToken);
        }

        // ავთენტიფიკაციის ტოკენის გენერირება
        const token = this.generateToken(user._id, user.role);

        // უსაფრთხო მომხმარებლის მონაცემები
        const userData = user.toSafeObject();

        res.status(201).json({
            success: true,
            message: 'რეგისტრაცია წარმატებით დასრულდა',
            user: userData,
            token,
            verificationSent: process.env.SEND_EMAIL === 'true'
        });
    });

    /**
     * შესვლა
     */
    static login = catchAsync(async (req, res, next) => {
        const { email, password, role } = req.body;

        // მომხმარებლის პოვნა (პაროლის ჩათვლით)
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

        if (!user) {
            return next(new AppError('არასწორი ელ.ფოსტა ან პაროლი', 401));
        }

        // როლის შემოწმება (თუ მითითებულია)
        if (role && user.role !== role && user.role !== 'admin') {
            return next(new AppError(`მხოლოდ ${role} მომხმარებლებს შეუძლიათ შესვლა აქ`, 401));
        }

        // მომხმარებლის აქტივობის შემოწმება
        if (!user.isActive) {
            return next(new AppError('თქვენი ანგარიში დაბლოკილია. გთხოვთ დაგვიკავშირდეთ.', 403));
        }

        // პაროლის შემოწმება
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return next(new AppError('არასწორი ელ.ფოსტა ან პაროლი', 401));
        }

        // ტოკენის გენერირება
        const token = this.generateToken(user._id, user.role);

        // ლოგინის სტატისტიკის განახლება
        user.lastLogin = new Date();
        user.loginCount += 1;
        user.metadata = {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            deviceType: this.getDeviceType(req.headers['user-agent'])
        };
        await user.save();

        // უსაფრთხო მომხმარებლის მონაცემები
        const userData = user.toSafeObject();

        res.json({
            success: true,
            message: 'წარმატებით შეხვედით სისტემაში',
            user: userData,
            token
        });
    });

    /**
     * მომხმარებლის ვერიფიკაცია
     */
    static verifyUser = catchAsync(async (req, res, next) => {
        const { token } = req.params;

        // ტოკენის ჰეშირება
        const verificationTokenHash = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        // მომხმარებლის პოვნა ვალიდური ტოკენით
        const user = await User.findOne({
            verificationToken: verificationTokenHash,
            verificationExpires: { $gt: Date.now() },
            isVerified: false
        });

        if (!user) {
            return next(new AppError('ვერიფიკაციის ტოკენი არასწორია ან ვადაგასულია', 400));
        }

        // მომხმარებლის ვერიფიკაცია
        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationExpires = undefined;
        await user.save();

        // ავთენტიფიკაციის ტოკენის გენერირება
        const authToken = this.generateToken(user._id, user.role);

        res.json({
            success: true,
            message: 'თქვენი ანგარიში წარმატებით გაიარა ვერიფიკაცია',
            user: user.toSafeObject(),
            token: authToken
        });
    });

    /**
     * პაროლის შეცვლა
     */
    static changePassword = catchAsync(async (req, res, next) => {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id).select('+password');

        // მიმდინარე პაროლის შემოწმება
        const isPasswordValid = await user.comparePassword(currentPassword);
        if (!isPasswordValid) {
            return next(new AppError('მიმდინარე პაროლი არასწორია', 401));
        }

        // ახალი პაროლის დაყენება
        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: 'პაროლი წარმატებით შეიცვალა'
        });
    });

    /**
     * პაროლის აღდგენის მოთხოვნა
     */
    static forgotPassword = catchAsync(async (req, res, next) => {
        const { email } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });

        // თუ მომხმარებელი არ არსებობს, მაინც დაბრუნდეს წარმატება (უსაფრთხოებისთვის)
        if (!user) {
            return res.json({
                success: true,
                message: 'თუ ეს ელ.ფოსტა რეგისტრირებულია, მიიღებთ პაროლის აღდგენის ინსტრუქციას'
            });
        }

        // პაროლის აღდგენის ტოკენის გენერირება
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenHash = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');

        // ტოკენის შენახვა მონაცემთა ბაზაში
        user.resetPasswordToken = resetTokenHash;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 საათი
        await user.save();

        // პაროლის აღდგენის ელ.ფოსტის გაგზავნა (თუ დაყენებულია)
        if (process.env.SEND_EMAIL === 'true') {
            await this.sendPasswordResetEmail(user, resetToken);
        }

        res.json({
            success: true,
            message: 'თუ ეს ელ.ფოსტა რეგისტრირებულია, მიიღებთ პაროლის აღდგენის ინსტრუქციას',
            // resetToken: resetToken // მხოლოდ development-ისთვის
        });
    });

    /**
     * პაროლის აღდგენა
     */
    static resetPassword = catchAsync(async (req, res, next) => {
        const { token } = req.params;
        const { password } = req.body;

        // ტოკენის ჰეშირება
        const resetTokenHash = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        // მომხმარებლის პოვნა ვალიდური ტოკენით
        const user = await User.findOne({
            resetPasswordToken: resetTokenHash,
            resetPasswordExpires: { $gt: Date.now() }
        }).select('+password');

        if (!user) {
            return next(new AppError('პაროლის აღდგენის ტოკენი არასწორია ან ვადაგასულია', 400));
        }

        // ახალი პაროლის დაყენება
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({
            success: true,
            message: 'პაროლი წარმატებით შეიცვალა'
        });
    });

    /**
     * სოციალური ავთენტიფიკაცია
     */
    static socialAuth = catchAsync(async (req, res, next) => {
        const { provider, token, email, name, avatar, phone } = req.body;

        // TODO: სოციალური ტოკენის ვალიდაცია
        // const socialUser = await this.validateSocialToken(provider, token);

        // მომხმარებლის პოვნა ან შექმნა
        let user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            // ახალი მომხმარებლის შექმნა
            user = new User({
                name,
                email: email.toLowerCase(),
                phone: phone || '',
                password: crypto.randomBytes(16).toString('hex'), // რანდომ პაროლი
                role: 'customer',
                isVerified: true,
                avatar: avatar || '/images/default-avatar.png'
            });

            await user.save();
        }

        // ტოკენის გენერირება
        const authToken = this.generateToken(user._id, user.role);

        // უსაფრთხო მომხმარებლის მონაცემები
        const userData = user.toSafeObject();

        res.json({
            success: true,
            message: 'წარმატებით შეხვედით სისტემაში',
            user: userData,
            token: authToken
        });
    });

    /**
     * ტოკენის განახლება
     */
    static refreshToken = catchAsync(async (req, res, next) => {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return next(new AppError('Refresh token აუცილებელია', 401));
        }

        try {
            // ვალიდაცია
            const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
            
            // მომხმარებლის პოვნა
            const user = await User.findById(decoded.id);
            
            if (!user || !user.isActive) {
                return next(new AppError('მომხმარებელი ვერ მოიძებნა ან დაბლოკილია', 401));
            }
            
            // ახალი ტოკენის გენერირება
            const newToken = this.generateToken(user._id, user.role);
            
            res.json({
                success: true,
                token: newToken,
                user: user.toSafeObject()
            });
            
        } catch (error) {
            return next(new AppError('არასწორი refresh token', 401));
        }
    });

    /**
     * მომხმარებლის სტატუსის შემოწმება
     */
    static checkStatus = catchAsync(async (req, res, next) => {
        const user = await User.findById(req.user._id);

        if (!user) {
            return next(new AppError('მომხმარებელი ვერ მოიძებნა', 404));
        }

        const userData = user.toSafeObject();

        res.json({
            success: true,
            user: userData,
            isAuthenticated: true
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
        const token = this.generateToken(user._id, user.role);

        res.json({
            success: true,
            message: 'თქვენი ანგარიში გააქტიურდა',
            user: user.toSafeObject(),
            token
        });
    });

    /**
     * დამხმარე მეთოდები
     */

    // ტოკენის გენერირება
    static generateToken(userId, role) {
        return jwt.sign(
            { id: userId, role },
            process.env.JWT_SECRET || 'homras-secret-key-change-in-production',
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );
    }

    // ვერიფიკაციის ელ.ფოსტის გაგზავნა
    static async sendVerificationEmail(user, token) {
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;
        
        // TODO: ელ.ფოსტის გაგზავნის იმპლემენტაცია (nodemailer, sendgrid, etc.)
        console.log(`Verification email for ${user.email}: ${verificationUrl}`);
        
        // მაგალითი nodemailer-ით:
        /*
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        await transporter.sendMail({
            from: '"HOMRAS" <noreply@homras.ge>',
            to: user.email,
            subject: 'HOMRAS - ელ.ფოსტის ვერიფიკაცია',
            html: `
                <h1>კეთილი იყოს თქვენი მობრძანება HOMRAS-ში!</h1>
                <p>გთხოვთ დააჭიროთ ქვემოთ მოცემულ ბმულს თქვენი ელ.ფოსტის ვერიფიკაციისთვის:</p>
                <a href="${verificationUrl}">ვერიფიკაცია</a>
                <p>ბმული ვადაგასულია 24 საათში.</p>
            `
        });
        */
    }

    // პაროლის აღდგენის ელ.ფოსტის გაგზავნა
    static async sendPasswordResetEmail(user, token) {
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;
        
        // TODO: ელ.ფოსტის გაგზავნის იმპლემენტაცია
        console.log(`Password reset email for ${user.email}: ${resetUrl}`);
        
        /*
        await transporter.sendMail({
            from: '"HOMRAS" <noreply@homras.ge>',
            to: user.email,
            subject: 'HOMRAS - პაროლის აღდგენა',
            html: `
                <h1>პაროლის აღდგენა</h1>
                <p>თქვენ მიიღეთ ეს ელ.ფოსტა, რადგან მოთხოვნილი გაქვთ პაროლის აღდგენა.</p>
                <p>გთხოვთ დააჭიროთ ქვემოთ მოცემულ ბმულს ახალი პაროლის დასაყენებლად:</p>
                <a href="${resetUrl}">პაროლის აღდგენა</a>
                <p>ბმული ვადაგასულია 1 საათში.</p>
                <p>თუ თქვენ არ მოგითხოვიათ პაროლის აღდგენა, გთხოვთ უგულებელყოთ ეს ელ.ფოსტა.</p>
            `
        });
        */
    }

    // დევაისის ტიპის განსაზღვრა
    static getDeviceType(userAgent) {
        if (!userAgent) return 'unknown';
        
        if (/mobile/i.test(userAgent)) {
            return 'mobile';
        } else if (/tablet/i.test(userAgent)) {
            return 'tablet';
        } else {
            return 'desktop';
        }
    }

    // სოციალური ტოკენის ვალიდაცია
    static async validateSocialToken(provider, token) {
        // TODO: სოციალური ავთენტიფიკაციის იმპლემენტაცია
        switch (provider) {
            case 'google':
                // Google API ვალიდაცია
                break;
            case 'facebook':
                // Facebook API ვალიდაცია
                break;
            default:
                throw new AppError('არასწორი სოციალური პროვაიდერი', 400);
        }
    }
}

module.exports = AuthController;