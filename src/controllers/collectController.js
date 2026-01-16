const prisma = require('../lib/prisma');

/**
 * GET /api/v1/collect/:slug
 * Returns a single glossary item by slug with video reference
 * Protected: Requires authentication
 * Use this for the briefing phase on the recording screen
 */
const getAssignmentBySlug = async (req, res, next) => {
    try {
        const { slug } = req.params;

        // Fetch glossary item by slug
        const glossaryItem = await prisma.glossary.findUnique({
            where: {
                slug: slug,
            },
            select: {
                id: true,
                slug: true,
                category: true,
                videoReferenceUrl: true,
                priority: true,
            },
        });

        // If not found, return 404
        if (!glossaryItem) {
            return res.status(404).json({
                success: false,
                error: {
                    message: `Assignment with slug "${slug}" not found`,
                },
            });
        }

        res.json({
            success: true,
            data: glossaryItem,
        });
    } catch (error) {
        console.error('Get assignment by slug error:', error);
        next(error);
    }
};

module.exports = {
    getAssignmentBySlug,
};
