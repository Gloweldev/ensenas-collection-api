const admin = require('firebase-admin');
const config = require('../config');

// Initialize Firebase Admin SDK
if (config.firebase.serviceAccountPath) {
    const serviceAccount = require(`../../${config.firebase.serviceAccountPath}`);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: config.firebase.projectId,
    });
} else {
    // For production/cloud environments, use default credentials
    admin.initializeApp();
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
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name,
        };

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
