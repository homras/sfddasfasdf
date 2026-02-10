const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');

// რეგისტრაცია
router.post('/register', AuthController.register);

// შესვლა
router.post('/login', AuthController.login);

// ვერიფიკაცია
router.get('/verify/:token', AuthController.verifyUser);

// პაროლის შეცვლა
router.post('/change-password', AuthController.changePassword);

// პაროლის აღდგენის მოთხოვნა
router.post('/forgot-password', AuthController.forgotPassword);

// პაროლის აღდგენა
router.post('/reset-password/:token', AuthController.resetPassword);

// სოციალური ავთენტიფიკაცია
router.post('/social', AuthController.socialAuth);

// ტოკენის განახლება
router.post('/refresh-token', AuthController.refreshToken);

// სტატუსის შემოწმება
router.get('/status', AuthController.checkStatus);

// ანგარიშის აქტივაცია
router.post('/activate', AuthController.activateAccount);

module.exports = router;