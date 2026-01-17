const prisma = require('../lib/prisma');
const { generateBatchUploadUrls, generateSingleUploadUrls, deleteObject, generateDownloadUrl } = require('../services/storageService');

/**
 * POST /api/v1/recordings/init-upload
 * Initialize video upload session and get presigned URLs
 * 
 * Body: { assignmentId: number, count: number, contentType?: string, metadata?: object }
 * Returns: [{ recordingId, uploadUrl, key }]
 */
const initializeUpload = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { assignmentId, count, contentType = 'video/webm', metadata = {} } = req.body;



        // Validate request body
        if (!assignmentId || !count) {
            return res.status(400).json({
                success: false,
                error: { message: 'assignmentId and count are required' },
            });
        }

        if (count < 1 || count > 20) {
            return res.status(400).json({
                success: false,
                error: { message: 'count must be between 1 and 20' },
            });
        }

        // Verify assignment exists
        const assignment = await prisma.glossary.findUnique({
            where: { id: assignmentId },
            select: { id: true, slug: true },
        });



        if (!assignment) {
            return res.status(404).json({
                success: false,
                error: { message: 'Assignment not found' },
            });
        }

        // Generate presigned URLs
        const uploadData = await generateBatchUploadUrls(
            userId,
            assignment.slug,
            count,
            contentType
        );



        // Create recording entries in database
        const recordings = await Promise.all(
            uploadData.map(async ({ key, uploadUrl }, index) => {
                const recording = await prisma.recording.create({
                    data: {
                        userId: userId,
                        glossaryId: assignmentId,
                        s3Key: key,
                        filename: `recording_${index + 1}.webm`,
                        contentType: contentType,
                        status: 'UPLOADING',
                        metadata: metadata,
                    },
                });

                return {
                    recordingId: recording.id,
                    uploadUrl,
                    key,
                };
            })
        );

        res.json({
            success: true,
            data: {
                recordings,
                expiresIn: 15 * 60, // 15 minutes in seconds
            },
        });
    } catch (error) {
        console.error('Initialize upload error:', error);
        next(error);
    }
};

/**
 * POST /api/v1/recordings/confirm-upload
 * Confirm successful upload and mark recordings as pending review
 * Also updates user gamification stats (streak, reputation)
 * 
 * Body: { recordingIds: string[] }
 */
const confirmUpload = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { recordingIds } = req.body;

        // Validate request body
        if (!recordingIds || !Array.isArray(recordingIds) || recordingIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: { message: 'recordingIds array is required' },
            });
        }

        // Verify all recordings exist and belong to the user
        const recordings = await prisma.recording.findMany({
            where: {
                id: { in: recordingIds },
                userId: userId,
                status: 'UPLOADING',
            },
        });

        if (recordings.length !== recordingIds.length) {
            return res.status(403).json({
                success: false,
                error: { message: 'Some recordings not found or unauthorized' },
            });
        }

        // Update status to PENDING (ready for review/processing)
        const updateResult = await prisma.recording.updateMany({
            where: {
                id: { in: recordingIds },
                userId: userId,
            },
            data: {
                status: 'PENDING',
            },
        });

        // ========== Update User Gamification Stats ==========

        // Get current user data for streak calculation
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { currentStreak: true, lastContributionAt: true }
        });

        // Calculate new streak
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let newStreak = 1;
        if (user && user.lastContributionAt) {
            const lastDate = new Date(user.lastContributionAt);
            lastDate.setHours(0, 0, 0, 0);

            const diffTime = today.getTime() - lastDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
                // Same day - keep current streak
                newStreak = user.currentStreak;
            } else if (diffDays === 1) {
                // Next day - increment streak
                newStreak = user.currentStreak + 1;
            } else {
                // Streak broken (more than 1 day gap) - reset to 1
                newStreak = 1;
            }
        }

        // Update user stats: streak, last contribution, and reputation
        await prisma.user.update({
            where: { id: userId },
            data: {
                currentStreak: newStreak,
                lastContributionAt: new Date(),
                reputationScore: { increment: recordingIds.length * 10 } // +10 points per video
            }
        });

        res.json({
            success: true,
            data: {
                confirmedCount: updateResult.count,
                newStreak: newStreak,
                pointsEarned: recordingIds.length * 10,
                message: 'Recordings confirmed and stats updated',
            },
        });
    } catch (error) {
        console.error('Confirm upload error:', error);
        next(error);
    }
};

/**
 * GET /api/v1/recordings/my-recordings
 * Get user's recordings with pagination
 * 
 * Query: { page?: number, limit?: number, status?: string }
 */
const getMyRecordings = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const status = req.query.status;
        const ids = req.query.ids; // Comma separated IDs
        const glossaryId = req.query.glossaryId ? parseInt(req.query.glossaryId) : null;
        const skip = (page - 1) * limit;

        const where = { userId };

        // Handle ID filtering
        if (ids) {
            const idList = ids.split(',').filter(id => id.trim().length > 0);
            if (idList.length > 0) {
                where.id = { in: idList };
            }
        }

        // Handle Assignment filtering (Session Restore)
        if (glossaryId) {
            where.glossaryId = glossaryId;
            // When restoring a session, we typically want unsubmitted videos (PENDING or UPLOADING)
            // But if status is explicitly provided, respect it.
            // If not provided, we might default to retrieving valid session recordings.
        }

        if (status) {
            where.status = status;
        } else if (glossaryId && !ids) {
            // Default for session restore: Get only UPLOADING (interrupted sessions)
            // If status is PENDING, it means they are already submitted, so we don't restore them
            where.status = 'UPLOADING';
        }

        const [recordings, total] = await Promise.all([
            prisma.recording.findMany({
                where,
                skip: ids ? undefined : skip, // Don't paginate if specific IDs requested
                take: ids ? undefined : limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    glossary: {
                        select: { slug: true, category: true },
                    },
                },
            }),
            prisma.recording.count({ where }),
        ]);

        // Generate presigned URLs for preview if IDs were requested or if restoring session via glossaryId
        let recordingsWithUrls = recordings;
        // We want previews if we are fetching specific IDs or filtering by glossary (studio restore context)
        if (ids || glossaryId) {
            recordingsWithUrls = await Promise.all(recordings.map(async (rec) => {
                try {
                    // Generate download URL for 1 hour
                    const previewUrl = await generateDownloadUrl(rec.s3Key);
                    return { ...rec, previewUrl }; // Add previewUrl to response
                } catch (err) {
                    console.error(`Failed to generate URL for ${rec.id}:`, err);
                    return rec;
                }
            }));
        }

        res.json({
            success: true,
            data: {
                recordings: recordingsWithUrls,
                pagination: {
                    page,
                    limit: ids ? recordings.length : limit,
                    total,
                    totalPages: ids ? 1 : Math.ceil(total / limit),
                },
            },
        });
    } catch (error) {
        console.error('Get recordings error:', error);
        next(error);
    }
};

/**
 * GET /api/v1/recordings/debug
 * Debug endpoint to check storage and database status
 */
const debugStatus = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Count recordings by status
        const recordingStats = await prisma.recording.groupBy({
            by: ['status'],
            where: { userId },
            _count: { status: true },
        });

        // Get recent recordings
        const recentRecordings = await prisma.recording.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
                id: true,
                s3Key: true,
                filename: true,
                status: true,
                createdAt: true,
                glossary: { select: { slug: true } },
            },
        });

        // Check storage config
        const storageConfig = {
            endpoint: process.env.S3_ENDPOINT || 'Not set',
            bucket: process.env.S3_BUCKET || 'Not set',
            region: process.env.S3_REGION || 'Not set',
            hasCredentials: !!(process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY),
        };

        res.json({
            success: true,
            data: {
                user: {
                    id: userId,
                    email: req.user.email,
                },
                storage: storageConfig,
                recordings: {
                    stats: recordingStats,
                    recent: recentRecordings,
                },
            },
        });
    } catch (error) {
        console.error('Debug status error:', error);
        next(error);
    }
};

/**
 * POST /api/v1/recordings/upload-single
 * Initialize upload for a single video and return presigned URLs (upload + download)
 * Used for streaming upload during recording session
 * 
 * Body: { assignmentId: number, contentType?: string, metadata?: object, index?: number }
 * Returns: { recordingId, uploadUrl, downloadUrl, key }
 */
const uploadSingle = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { assignmentId, contentType = 'video/webm', metadata = {}, index = 0 } = req.body;

        // Validate request body
        if (!assignmentId) {
            return res.status(400).json({
                success: false,
                error: { message: 'assignmentId is required' },
            });
        }

        // Verify assignment exists
        const assignment = await prisma.glossary.findUnique({
            where: { id: assignmentId },
            select: { id: true, slug: true },
        });

        if (!assignment) {
            return res.status(404).json({
                success: false,
                error: { message: 'Assignment not found' },
            });
        }

        // Generate presigned URLs (upload + download)
        const { key, uploadUrl, downloadUrl } = await generateSingleUploadUrls(
            userId,
            assignment.slug,
            contentType
        );

        // Create recording entry in database
        const recording = await prisma.recording.create({
            data: {
                userId: userId,
                glossaryId: assignmentId,
                s3Key: key,
                filename: `recording_${index + 1}.webm`,
                contentType: contentType,
                status: 'UPLOADING',
                metadata: metadata,
            },
        });

        res.json({
            success: true,
            data: {
                recordingId: recording.id,
                uploadUrl,
                downloadUrl,
                key,
            },
        });
    } catch (error) {
        console.error('Upload single error:', error);
        next(error);
    }
};

/**
 * DELETE /api/v1/recordings/:id
 * Delete a recording from database and S3/MinIO
 * 
 * Params: { id: string }
 */
const deleteRecording = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        // Find the recording
        const recording = await prisma.recording.findUnique({
            where: { id },
        });

        if (!recording) {
            return res.status(404).json({
                success: false,
                error: { message: 'Recording not found' },
            });
        }

        // Verify ownership
        if (recording.userId !== userId) {
            return res.status(403).json({
                success: false,
                error: { message: 'Unauthorized to delete this recording' },
            });
        }

        // Delete from S3/MinIO
        try {
            await deleteObject(recording.s3Key);
        } catch (s3Error) {
            // Log but don't fail if S3 delete fails (file might not exist yet)
            console.error('S3 delete error (non-fatal):', s3Error.message);
        }

        // Delete from database
        await prisma.recording.delete({
            where: { id },
        });

        res.json({
            success: true,
            data: {
                message: 'Recording deleted successfully',
                deletedId: id,
            },
        });
    } catch (error) {
        console.error('Delete recording error:', error);
        next(error);
    }
};

/**
 * POST /api/v1/recordings/delete-session
 * Delete multiple recordings in one request (for browser close cleanup via sendBeacon)
 * 
 * Body: { recordingIds: string[] }
 */
const deleteSession = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { recordingIds } = req.body;

        if (!recordingIds || !Array.isArray(recordingIds)) {
            return res.status(400).json({
                success: false,
                error: 'recordingIds array is required',
            });
        }

        let deletedCount = 0;

        for (const id of recordingIds) {
            try {
                // Skip temp IDs
                if (id.startsWith('temp-')) continue;

                const recording = await prisma.recording.findUnique({
                    where: { id },
                    select: { id: true, userId: true, s3Key: true },
                });

                if (recording && recording.userId === userId) {
                    // Delete from S3/MinIO
                    if (recording.s3Key) {
                        await deleteObject(recording.s3Key);
                    }
                    // Delete from database
                    await prisma.recording.delete({ where: { id } });
                    deletedCount++;
                }
            } catch (err) {
                // Continue with other deletions even if one fails
                console.error(`Failed to delete recording ${id}:`, err.message);
            }
        }

        res.json({
            success: true,
            data: {
                message: `Deleted ${deletedCount} recordings`,
                deletedCount,
            },
        });
    } catch (error) {
        console.error('Delete session error:', error);
        next(error);
    }
};

module.exports = {
    initializeUpload,
    confirmUpload,
    getMyRecordings,
    debugStatus,
    uploadSingle,
    deleteRecording,
    deleteSession,
};
