const prisma = require('../lib/prisma');

/**
 * Calculate user level based on reputation score
 */
const calculateLevel = (reputationScore) => {
    if (reputationScore >= 50) return 'Maestro';
    if (reputationScore >= 10) return 'Explorador';
    return 'Iniciado';
};

/**
 * GET /api/v1/dashboard/me
 * Optimized dashboard data - ONLY what dashboard needs
 * Protected: Requires authentication
 */
const getDashboardData = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Fetch user with recordings
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                name: true,
                currentStreak: true,
                reputationScore: true,
                recordings: {
                    select: {
                        status: true,
                        glossaryId: true,
                    },
                },
            },
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }

        // Calculate stats
        const totalGlossary = await prisma.glossary.count();

        // Count distinct glossary items that user has contributed to (PENDING, PROCESSING, or APPROVED)
        // This means user has at least submitted videos for these words
        const contributedGlossaryIds = new Set(
            user.recordings
                .filter(r => r.status === 'PENDING' || r.status === 'PROCESSING' || r.status === 'APPROVED')
                .map(r => r.glossaryId)
        );
        const totalContributed = contributedGlossaryIds.size;

        // Count only APPROVED as fully completed (for reference, but we show contributed in dashboard)
        const approvedGlossaryIds = new Set(
            user.recordings
                .filter(r => r.status === 'APPROVED')
                .map(r => r.glossaryId)
        );

        // Progress is based on contributed words (submitted, not just approved)
        const progress = totalGlossary > 0
            ? Math.round((totalContributed / totalGlossary) * 100)
            : 0;

        // Find next mission - exclude any glossary where user has already contributed
        const userContributedIds = Array.from(contributedGlossaryIds);
        const nextMission = await prisma.glossary.findFirst({
            where: {
                id: {
                    notIn: userContributedIds.length > 0 ? userContributedIds : [-1], // Prisma needs array
                },
            },
            orderBy: [
                { priority: 'asc' },
                { slug: 'asc' },
            ],
            select: {
                id: true,
                slug: true,
                category: true,
                priority: true,
            },
        });

        // Get top 3 priority assignments - exclude where user has contributed
        const topPriorityAssignments = await prisma.glossary.findMany({
            where: {
                id: {
                    notIn: userContributedIds.length > 0 ? userContributedIds : [-1],
                },
            },
            orderBy: [
                { priority: 'asc' },
                { slug: 'asc' },
            ],
            take: 3,
            select: {
                id: true,
                slug: true,
                category: true,
                priority: true,
            },
        });

        // Count pending submissions (still being processed)
        const pendingCount = user.recordings.filter(r =>
            r.status === 'PENDING' || r.status === 'PROCESSING'
        ).length;

        // Build response - ONLY dashboard data
        res.json({
            success: true,
            data: {
                user: {
                    name: user.name || 'Usuario',
                    streak: user.currentStreak,
                    level: calculateLevel(user.reputationScore),
                    score: user.reputationScore,
                },
                stats: {
                    progress: progress,
                    totalCompleted: totalContributed, // Words user has contributed videos for
                    totalGlossary: totalGlossary,
                    pending: pendingCount,
                    nextMission: nextMission ? {
                        id: nextMission.id,
                        slug: nextMission.slug,
                        category: nextMission.category,
                        priority: nextMission.priority,
                    } : null,
                },
                priorityAssignments: topPriorityAssignments.map(a => ({
                    id: a.id,
                    slug: a.slug,
                    category: a.category,
                    priority: a.priority,
                })),
            },
        });
    } catch (error) {
        console.error('Dashboard data error:', error);
        next(error);
    }
};

module.exports = {
    getDashboardData,
};
