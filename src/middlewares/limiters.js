const rateLimit = require('express-rate-limit');
const config = require('../config');

// Standard API Limiter (Relaxed)
// Allows standard usage (dashboard loading, video uploads, etc.)
const apiLimiter = rateLimit({
    windowMs: config.rateLimit.api.windowMs,
    max: config.rateLimit.api.max,
    message: {
        success: false,
        error: 'Too many requests, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Auth Limiter (Strict)
// Prevents brute force attacks on login/register
const authLimiter = rateLimit({
    windowMs: config.rateLimit.auth.windowMs,
    max: config.rateLimit.auth.max,
    message: {
        success: false,
        error: 'Too many login attempts, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    apiLimiter,
    authLimiter
};
