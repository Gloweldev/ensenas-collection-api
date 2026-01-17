const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

module.exports = {
    // Server
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT, 10) || 3000,

    // Database
    DATABASE_URL: process.env.DATABASE_URL,

    // S3/MinIO Storage
    storage: {
        endpoint: process.env.S3_ENDPOINT, // undefined for AWS S3, URL for MinIO
        region: process.env.S3_REGION || 'us-east-1',
        bucket: process.env.S3_BUCKET || 'ensenas-videos',
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY,
            secretAccessKey: process.env.S3_SECRET_KEY,
        },
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true', // Required for MinIO
    },

    // Firebase
    firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID,
        serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
        serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    },

    // Security
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    },

    // Rate Limiting
    rateLimit: {
        // General API (High traffic)
        api: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: parseInt(process.env.RATE_LIMIT_API_MAX, 10) || 1000,
        },
        // Auth (Strict security)
        auth: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: parseInt(process.env.RATE_LIMIT_AUTH_MAX, 10) || 20,
        }
    },

    // Presigned URLs
    presignedUrlExpiry: parseInt(process.env.PRESIGNED_URL_EXPIRY, 10) || 300, // 5 minutes
};
