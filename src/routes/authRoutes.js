const express = require('express');
const authGuard = require('../middlewares/authGuard');
const { loginOrRegister } = require('../controllers/authController');

const { authLimiter } = require('../middlewares/limiters');

const router = express.Router();

// POST /api/v1/auth/sync - Sync user with database
router.post('/sync', authLimiter, authGuard, loginOrRegister);

module.exports = router;
