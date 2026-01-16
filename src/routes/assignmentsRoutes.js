const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { getAssignments } = require('../controllers/assignmentsController');

const router = express.Router();

// All assignments routes require authentication
router.use(authMiddleware);

// GET /api/v1/assignments - Get all glossary items with user progress
router.get('/', getAssignments);

module.exports = router;
