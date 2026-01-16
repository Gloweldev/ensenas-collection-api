const storageService = require('../services/storageService');

/**
 * Generate a presigned URL for video upload
 */
const getUploadUrl = async (req, res, next) => {
    try {
        const { filename, contentType, signName } = req.body;

        if (!filename || !contentType || !signName) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: filename, contentType, signName',
            });
        }

        // Generate unique S3 key
        const key = storageService.generateVideoKey(req.user.uid, signName, filename);

        // Generate presigned upload URL
        const uploadUrl = await storageService.generateUploadUrl(key, contentType);

        res.json({
            success: true,
            data: {
                uploadUrl,
                key, // Return key for future reference
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Confirm video upload and save metadata
 */
const confirmUpload = async (req, res, next) => {
    try {
        const { key, signName, duration } = req.body;

        if (!key || !signName) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: key, signName',
            });
        }

        // TODO: Save video metadata to database using Prisma
        // const video = await prisma.video.create({ ... });

        res.json({
            success: true,
            message: 'Video upload confirmed',
            data: {
                key,
                signName,
                duration,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getUploadUrl,
    confirmUpload,
};
