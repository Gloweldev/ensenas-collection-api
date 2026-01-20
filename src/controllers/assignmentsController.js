const prisma = require('../lib/prisma');

/**
 * GET /api/v1/assignments
 * Returns ALL glossary items with user progress
 * Protected: Requires authentication
 * Use this for the assignments page only
 */
const getAssignments = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // RBAC Filter Logic
        const userRole = req.user.role;
        const isAdmin = userRole === 'ADMIN';

        const whereClause = {};

        if (!isAdmin) {
            whereClause.AND = [
                { status: 'ACTIVE' },
                {
                    OR: [
                        { visibility: 'PUBLIC' },
                        { allowed_roles: { has: userRole } }
                    ]
                }
            ];
        }

        // Fetch all glossary items with user's recordings
        const glossaryItems = await prisma.glossary.findMany({
            where: whereClause,
            orderBy: [
                { priority: 'asc' }, // Higher priority first (1 is highest)
                { slug: 'asc' },
            ],
            include: {
                recordings: {
                    where: {
                        userId: userId,
                    },
                    select: {
                        id: true,
                        status: true,
                    },
                },
            },
        });

        // Transform to minimal assignment format - only what UI needs
        const assignments = glossaryItems.map((item) => {
            let status = 'available';

            if (item.recordings.length > 0) {
                const hasApproved = item.recordings.some(r => r.status === 'APPROVED');
                const hasPending = item.recordings.some(r => r.status === 'PENDING' || r.status === 'PROCESSING');

                if (hasApproved) {
                    status = 'completed';
                } else if (hasPending) {
                    status = 'pending';
                }
            }

            return {
                id: item.id,
                slug: item.slug, // For URL: /collect/{slug}
                category: item.category, // For UI display
                status: status, // For filtering tabs
            };
        });

        res.json({
            success: true,
            data: {
                assignments: assignments,
            },
        });
    } catch (error) {
        console.error('Assignments error:', error);
        next(error);
    }
};

module.exports = {
    getAssignments,
};
