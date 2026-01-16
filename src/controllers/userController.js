const prisma = require('../lib/prisma');
const { onboardingSchema } = require('../utils/validation');

/**
 * Complete user onboarding
 * POST /api/v1/users/onboarding
 * Security: One-time only, validated input
 */
const completeOnboarding = async (req, res, next) => {
    try {
        console.log('=== ONBOARDING REQUEST ===');
        console.log('User:', req.user);
        console.log('Request body:', req.body);

        // Security Rule 1: Check if onboarding already completed
        if (req.user.onboardingCompleted) {
            return res.status(403).json({
                success: false,
                error: 'Onboarding already completed. Cannot update onboarding data.',
            });
        }

        // Validate request body with Zod
        const validationResult = onboardingSchema.safeParse(req.body);

        if (!validationResult.success) {
            console.error('Validation failed:', validationResult.error.errors);
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validationResult.error.errors,
            });
        }

        const { hearingStatus, lsmVariant, ageRange, gender } = validationResult.data;

        console.log('Validated data:', { hearingStatus, lsmVariant, ageRange, gender });

        // Update user with onboarding data
        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: {
                hearingStatus,
                lsmVariant,
                ageRange,
                gender,
                onboardingCompleted: true,
            },
            select: {
                id: true,
                email: true,
                name: true,
                hearingStatus: true,
                lsmVariant: true,
                ageRange: true,
                gender: true,
                onboardingCompleted: true,
                createdAt: true,
            },
        });

        console.log('Updated user:', updatedUser);

        res.json({
            success: true,
            message: 'Onboarding completed successfully',
            data: updatedUser,
        });
    } catch (error) {
        console.error('Onboarding error:', error);
        next(error);
    }
};

/**
 * Get current user profile
 * GET /api/v1/users/profile
 */
const getUserProfile = async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                email: true,
                name: true,
                hearingStatus: true,
                lsmVariant: true,
                ageRange: true,
                gender: true,
                onboardingCompleted: true,
                lastLoginAt: true,
                createdAt: true,
            },
        });

        res.json({
            success: true,
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    completeOnboarding,
    getUserProfile,
};
