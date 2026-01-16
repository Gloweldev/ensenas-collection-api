const { PrismaClient } = require('@prisma/client');

/**
 * Prisma Client Singleton with Connection Management
 * - Prevents multiple instances from exhausting connections
 * - Handles graceful shutdown on all exit scenarios
 * - Optimized for Neon serverless PostgreSQL
 * https://www.prisma.io/docs/guides/performance-and-optimization/connection-management
 */

const globalForPrisma = global;

/**
 * Build DATABASE_URL with connection pool limits
 * Neon free tier has ~3-5 max connections, keep this very low
 */
function getDatabaseUrl() {
    const baseUrl = process.env.DATABASE_URL || '';
    const separator = baseUrl.includes('?') ? '&' : '?';
    // Very conservative for Neon: 3 connections, 20s timeout
    return `${baseUrl}${separator}connection_limit=3&pool_timeout=20`;
}

/**
 * Graceful shutdown function
 */
async function disconnectPrisma() {
    if (globalForPrisma.prisma) {
        console.log('[Prisma] Disconnecting from database...');
        try {
            await globalForPrisma.prisma.$disconnect();
            console.log('[Prisma] Disconnected successfully');
        } catch (e) {
            console.error('[Prisma] Error disconnecting:', e.message);
        }
    }
}

// Clean up any existing instance before creating new one (for hot-reload)
if (globalForPrisma.prisma && process.env.NODE_ENV === 'development') {
    console.log('[Prisma] Hot-reload detected, cleaning up existing instance...');
    // Don't await - just fire and forget since we're creating new instance
    globalForPrisma.prisma.$disconnect().catch(() => { });
}

if (!globalForPrisma.prisma) {
    console.log('[Prisma] Creating singleton with connection_limit=3, pool_timeout=20');
    globalForPrisma.prisma = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
        datasources: {
            db: {
                url: getDatabaseUrl(),
            },
        },
    });

    // Register shutdown handlers only once
    if (!globalForPrisma._prismaHandlersRegistered) {
        globalForPrisma._prismaHandlersRegistered = true;

        // Handle process exit
        process.on('beforeExit', disconnectPrisma);

        // Handle Ctrl+C and kill signals
        ['SIGINT', 'SIGTERM', 'SIGUSR2'].forEach(signal => {
            process.once(signal, async () => {
                console.log(`[Prisma] Received ${signal}`);
                await disconnectPrisma();
                process.exit(0);
            });
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', async (error) => {
            console.error('[Prisma] Uncaught exception:', error.message);
            await disconnectPrisma();
            process.exit(1);
        });
    }
} else {
    console.log('[Prisma] Reusing existing singleton instance');
}

const prisma = globalForPrisma.prisma;

module.exports = prisma;
