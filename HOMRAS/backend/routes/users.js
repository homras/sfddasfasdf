const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');

// ჩემი პროფილი
router.get('/profile', UserController.getMyProfile);

// პროფილის განახლება
router.put('/profile', UserController.updateProfile);

// ხელოსნების სია
router.get('/handymen', UserController.getHandymen);

// კონკრეტული ხელოსნის პროფილი
router.get('/handymen/:id', UserController.getHandymanProfile);

// მომხმარებლის შეფასებები
router.get('/:id/reviews', UserController.getUserReviews);

// ხელმისაწვდომობის განახლება
router.put('/availability', UserController.updateAvailability);

// ანგარიშის დეაქტივაცია
router.post('/deactivate', UserController.deactivateAccount);

// ანგარიშის აქტივაცია
router.post('/activate', UserController.activateAccount);

// ვერიფიკაციის მოთხოვნა
router.post('/verification/request', UserController.requestVerification);

// რეიტინგის განახლება
router.post('/handyman/:handymanId/rating', UserController.updateRating);

module.exports = router;