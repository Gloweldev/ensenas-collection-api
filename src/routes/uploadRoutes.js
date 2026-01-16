const express = require('express');
const authGuard = require('../middlewares/authGuard');
const { getUploadUrl, confirmUpload } = require('../controllers/uploadController');

const router = express.Router();

// All upload routes require authentication
router.use(authGuard);

// POST /api/v1/upload/presigned-url - Get presigned URL for upload
router.post('/presigned-url', getUploadUrl);

// POST /api/v1/upload/confirm - Confirm upload and save metadata
router.post('/confirm', confirmUpload);

module.exports = router;
