const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { completeOnboarding, getUserProfile } = require('../controllers/userController');

const router = express.Router();

// All user routes require authentication
router.use(authMiddleware);

// POST /api/v1/users/onboarding - Complete onboarding (one-time only)
router.post('/onboarding', completeOnboarding);

// GET /api/v1/users/profile - Get current user profile
router.get('/profile', getUserProfile);

module.exports = router;
