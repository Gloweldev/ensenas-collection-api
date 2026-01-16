const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');

/**
 * S3-Compatible Storage Service
 * Works with both AWS S3 and MinIO by changing environment variables
 */

// Initialize S3 client based on environment configuration
const createS3Client = () => {
    const config = {
        region: process.env.S3_REGION || 'us-east-1',
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY,
            secretAccessKey: process.env.S3_SECRET_KEY,
        },
    };

    // For MinIO or custom S3-compatible storage, set endpoint
    if (process.env.S3_ENDPOINT) {
        config.endpoint = process.env.S3_ENDPOINT;
        config.forcePathStyle = true; // Required for MinIO
    }

    return new S3Client(config);
};

const s3Client = createS3Client();
const BUCKET_NAME = process.env.S3_BUCKET || 'ensenas-videos';
const PRESIGNED_UPLOAD_EXPIRATION = 15 * 60; // 15 minutes
const PRESIGNED_DOWNLOAD_EXPIRATION = 60 * 60; // 1 hour for previews

/**
 * Generate a unique storage key for a recording
 * Format: raw/{userId}/{assignmentSlug}/{uuid}.webm
 */
const generateStorageKey = (userId, assignmentSlug, extension = 'webm') => {
    const uuid = uuidv4();
    return `raw/${userId}/${assignmentSlug}/${uuid}.${extension}`;
};

/**
 * Generate a presigned URL for uploading a file
 * @param {string} key - The S3 object key
 * @param {string} contentType - MIME type of the file (e.g., 'video/webm')
 * @returns {Promise<string>} Presigned PUT URL
 */
const generateUploadUrl = async (key, contentType) => {
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: contentType,
    });

    const url = await getSignedUrl(s3Client, command, {
        expiresIn: PRESIGNED_UPLOAD_EXPIRATION,
    });

    return url;
};

/**
 * Generate a presigned URL for downloading/viewing a file
 * @param {string} key - The S3 object key
 * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} Presigned GET URL
 */
const generateDownloadUrl = async (key, expiresIn = PRESIGNED_DOWNLOAD_EXPIRATION) => {
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    });

    const url = await getSignedUrl(s3Client, command, {
        expiresIn,
    });

    return url;
};

/**
 * Delete an object from S3/MinIO
 * @param {string} key - The S3 object key to delete
 * @returns {Promise<void>}
 */
const deleteObject = async (key) => {
    const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    });

    await s3Client.send(command);
};

/**
 * Generate upload and download URLs for a single recording
 * @param {string} userId - User ID
 * @param {string} assignmentSlug - Assignment slug
 * @param {string} contentType - MIME type (e.g., 'video/webm')
 * @returns {Promise<{key: string, uploadUrl: string, downloadUrl: string}>}
 */
const generateSingleUploadUrls = async (userId, assignmentSlug, contentType) => {
    const key = generateStorageKey(userId, assignmentSlug);
    const uploadUrl = await generateUploadUrl(key, contentType);
    const downloadUrl = await generateDownloadUrl(key);

    return { key, uploadUrl, downloadUrl };
};

/**
 * Generate multiple upload URLs for batch recording uploads
 * @param {string} userId - User ID
 * @param {string} assignmentSlug - Assignment slug
 * @param {number} count - Number of URLs to generate
 * @param {string} contentType - MIME type (e.g., 'video/webm')
 * @returns {Promise<Array<{key: string, uploadUrl: string}>>}
 */
const generateBatchUploadUrls = async (userId, assignmentSlug, count, contentType) => {
    const results = [];

    for (let i = 0; i < count; i++) {
        const key = generateStorageKey(userId, assignmentSlug);
        const uploadUrl = await generateUploadUrl(key, contentType);
        results.push({ key, uploadUrl });
    }

    return results;
};

module.exports = {
    s3Client,
    generateStorageKey,
    generateUploadUrl,
    generateDownloadUrl,
    generateSingleUploadUrls,
    generateBatchUploadUrls,
    deleteObject,
    BUCKET_NAME,
};

