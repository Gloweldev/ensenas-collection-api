const rateLimit = require('express-rate-limit');
const config = require('../config');

// Rate limiter to protect Raspberry Pi CPU
const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false,
});

module.exports = limiter;
