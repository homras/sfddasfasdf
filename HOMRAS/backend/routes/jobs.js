const express = require('express');
const router = express.Router();
const JobController = require('../controllers/jobController');

// ყველა სამუშაო
router.get('/', JobController.getAllJobs);

// ახალი სამუშაო
router.post('/', JobController.createJob);

// კონკრეტული სამუშაო
router.get('/:id', JobController.getJobById);

// სამუშაოს რედაქტირება
router.put('/:id', JobController.updateJob);

// სამუშაოს წაშლა
router.delete('/:id', JobController.deleteJob);

// სამუშაოზე განცხადება
router.post('/:id/apply', JobController.applyForJob);

// განცხადების მიღება
router.post('/:id/accept-application/:applicationId', JobController.acceptApplication);

// ჩემი სამუშაოები
router.get('/customer/my-jobs', JobController.getMyJobs);

// ჩემი განცხადებები
router.get('/handyman/my-applications', JobController.getMyApplications);

// სამუშაოს დასრულება
router.post('/:id/complete', JobController.completeJob);

// სამუშაოს გაუქმება
router.post('/:id/cancel', JobController.cancelJob);

// ხელმისაწვდომობის შემოწმება
router.get('/:id/availability', JobController.checkJobAvailability);

// ფოტოების დამატება
router.post('/:id/photos', JobController.addJobPhotos);

module.exports = router;