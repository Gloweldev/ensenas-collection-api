const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { getDashboardData } = require('../controllers/dashboardController');

const router = express.Router();

// All dashboard routes require authentication
router.use(authMiddleware);

// GET /api/v1/dashboard/me - Get full dashboard data with user profile
router.get('/me', getDashboardData);

module.exports = router;
