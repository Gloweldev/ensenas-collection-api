const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const routes = require('./routes');
const { apiLimiter } = require('./middlewares/limiters');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
    origin: (origin, callback) => {
        const allowedOrigins = config.cors.origin.split(',').map(o => o.trim());
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || config.cors.origin === '*') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));

// Rate limiting (General API)
app.use(apiLimiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/v1', routes);

// Error handling (must be last)
app.use(errorHandler);

module.exports = app;
