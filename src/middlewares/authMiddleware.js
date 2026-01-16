const prisma = require('../lib/prisma');
const admin = require('firebase-admin');
const config = require('../config');

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
    if (config.firebase.serviceAccountPath) {
        const serviceAccount = require(`../../${config.firebase.serviceAccountPath}`);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: config.firebase.projectId,
        });
    } else {
        admin.initializeApp();
    }
}

/**
 * "Iron Gate" Authentication Middleware
 * - Verifies Firebase token
 * - Auto-syncs users to PostgreSQL
 * - Enforces security rules (banned users)
 */
const authMiddleware = async (req, res, next) => {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'No token provided. Authorization header required.',
            });
        }

        const idToken = authHeader.split('Bearer ')[1];

        // Verify Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);

        // User sync logic: Check if user exists in our database
        let user = await prisma.user.findUnique({
            where: {
                firebaseUid: decodedToken.uid,
            },
        });

        // If user doesn't exist, create them (auto-sync)
        if (!user) {
            user = await prisma.user.create({
                data: {
                    firebaseUid: decodedToken.uid,
                    email: decodedToken.email,
                    name: decodedToken.name || decodedToken.displayName || null,
                    lastLoginAt: new Date(),
                },
            });
            console.log(`✅ New user auto-synced: ${user.email}`);
        } else {
            // Update last login timestamp and name if changed
            user = await prisma.user.update({
                where: { id: user.id },
                data: {
                    lastLoginAt: new Date(),
                    name: decodedToken.name || decodedToken.displayName || user.name,
                },
            });
        }

        // Security rule: Check if user is banned
        if (user.banned) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Your account has been suspended.',
            });
        }

        // Attach full user object to request
        req.user = user;
        req.firebaseUser = decodedToken;

        next();
    } catch (error) {
        console.error('Auth middleware error:', error.message);

        // Handle specific Firebase errors
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({
                success: false,
                error: 'Token expired. Please sign in again.',
            });
        }

        if (error.code === 'auth/argument-error') {
            return res.status(401).json({
                success: false,
                error: 'Invalid token format.',
            });
        }

        return res.status(401).json({
            success: false,
            error: 'Authentication failed. Invalid or expired token.',
        });
    }
};

module.exports = authMiddleware;
