const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const assignmentsRoutes = require('./assignmentsRoutes');
const collectRoutes = require('./collectRoutes');
const recordingsRoutes = require('./recordingsRoutes');
const uploadRoutes = require('./uploadRoutes');

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'EnSeñas Collection API is running',
        timestamp: new Date().toISOString(),
    });
});

// API routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/assignments', assignmentsRoutes);
router.use('/collect', collectRoutes);
router.use('/recordings', recordingsRoutes);
router.use('/upload', uploadRoutes);

module.exports = router;

