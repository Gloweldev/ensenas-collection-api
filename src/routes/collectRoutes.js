const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { getAssignmentBySlug } = require('../controllers/collectController');

const router = express.Router();

// All collect routes require authentication
router.use(authMiddleware);

// GET /api/v1/collect/:slug - Get single glossary item by slug for recording
router.get('/:slug', getAssignmentBySlug);

module.exports = router;
