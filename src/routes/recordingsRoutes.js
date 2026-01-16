const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const {
    initializeUpload,
    confirmUpload,
    getMyRecordings,
    debugStatus,
    uploadSingle,
    deleteRecording,
    deleteSession,
} = require('../controllers/recordingsController');

const router = express.Router();

// All recordings routes require authentication
router.use(authMiddleware);

// POST /api/v1/recordings/init-upload - Get presigned URLs for batch uploading
router.post('/init-upload', initializeUpload);

// POST /api/v1/recordings/upload-single - Get presigned URLs for single video (streaming)
router.post('/upload-single', uploadSingle);

// POST /api/v1/recordings/confirm-upload - Confirm successful uploads
router.post('/confirm-upload', confirmUpload);

// POST /api/v1/recordings/delete-session - Delete multiple recordings (for browser close)
router.post('/delete-session', deleteSession);

// GET /api/v1/recordings/my-recordings - Get user's recordings
router.get('/my-recordings', getMyRecordings);

// DELETE /api/v1/recordings/:id - Delete a recording
router.delete('/:id', deleteRecording);

// GET /api/v1/recordings/debug - Debug endpoint
router.get('/debug', debugStatus);

module.exports = router;



