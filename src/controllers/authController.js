const prisma = require('../lib/prisma');

/**
 * Login or register user (Upsert logic)
 * User info comes from Firebase token verification in authGuard middleware
 */
const loginOrRegister = async (req, res, next) => {
    try {
        const { uid, email, name } = req.user;

        // Upsert user in database
        const user = await prisma.user.upsert({
            where: {
                firebaseUid: uid,
            },
            update: {
                lastLoginAt: new Date(),
                // Optionally update name if it changed in Firebase
                ...(name && { name }),
            },
            create: {
                firebaseUid: uid,
                email: email,
                name: name || null,
                lastLoginAt: new Date(),
            },
        });

        res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                createdAt: user.createdAt,
                lastLoginAt: user.lastLoginAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    loginOrRegister,
};
