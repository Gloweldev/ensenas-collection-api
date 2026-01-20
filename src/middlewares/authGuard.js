const admin = require('firebase-admin');
const config = require('../config');

// Initialize Firebase Admin SDK
// Initialize Firebase Admin SDK
if (config.firebase.serviceAccountJson) {
    // Priority 1: Environment Variable (Production/Cloud)
    try {
        const serviceAccount = JSON.parse(config.firebase.serviceAccountJson);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: config.firebase.projectId,
        });
        console.log('Firebase Admin initialized via JSON env var');
    } catch (error) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', error);
        process.exit(1);
    }
} else if (config.firebase.serviceAccountPath) {
    // Priority 2: Local File (Development)
    try {
        const serviceAccount = require(`../../${config.firebase.serviceAccountPath}`);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: config.firebase.projectId,
        });
        console.log('Firebase Admin initialized via local file');
    } catch (error) {
        console.warn('Warning: Service account file not found at path:', config.firebase.serviceAccountPath);
        // Fallback to default credentials
        admin.initializeApp();
    }
} else {
    // Priority 3: Default/Implicit Credentials (GCP)
    admin.initializeApp();
    console.log('Firebase Admin initialized via default credentials');
}

/**
 * Middleware to verify Firebase ID tokens
 */
const authGuard = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'No token provided',
            });
        }

        const idToken = authHeader.split('Bearer ')[1];

        // Verify the Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);

        // Attach user info to request
        // Fetch full user from database to get Role and internal ID
        const prisma = require('../lib/prisma');
        const user = await prisma.user.findUnique({
            where: { firebaseUid: decodedToken.uid },
        });

        if (!user) {
            // Optional: Auto-create user if not exists (sync), or fail.
            // For now, fail if not synced (assuming frontend calls sync endpoint first)
            return res.status(401).json({
                success: false,
                error: 'User not synced with database'
            });
        }

        req.user = user;

        next();
    } catch (error) {
        console.error('Auth error:', error.message);
        return res.status(401).json({
            success: false,
            error: 'Invalid or expired token',
        });
    }
};

module.exports = authGuard;
