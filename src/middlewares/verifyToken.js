const admin = require('firebase-admin');

/**
 * Middleware to verify Firebase ID tokens without checking DB
 * Used for registration/sync endpoints where user might not exist yet
 */
const verifyToken = async (req, res, next) => {
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

        // Attach decoded token to request
        req.user = decodedToken;

        next();
    } catch (error) {
        console.error('Token verification error:', error.message);
        return res.status(401).json({
            success: false,
            error: 'Invalid or expired token',
        });
    }
};

module.exports = verifyToken;
