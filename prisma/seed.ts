import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * MVP Glossary Dataset - 50 Genesis Words
 * Categories: social, verb, context, question
 */
const genesisGlossary = [
    // Social (10 words) - Basic courtesy and communication
    { slug: 'hola', category: 'social', priority: 1 },
    { slug: 'gracias', category: 'social', priority: 1 },
    { slug: 'por_favor', category: 'social', priority: 1 },
    { slug: 'perdon', category: 'social', priority: 1 },
    { slug: 'disculpa', category: 'social', priority: 2 },
    { slug: 'adios', category: 'social', priority: 1 },
    { slug: 'buenos_dias', category: 'social', priority: 2 },
    { slug: 'buenas_tardes', category: 'social', priority: 2 },
    { slug: 'buenas_noches', category: 'social', priority: 2 },
    { slug: 'si', category: 'social', priority: 1 },

    // Verbs (15 words) - Essential actions
    { slug: 'necesitar', category: 'verb', priority: 1 },
    { slug: 'ayudar', category: 'verb', priority: 1 },
    { slug: 'esperar', category: 'verb', priority: 1 },
    { slug: 'buscar', category: 'verb', priority: 2 },
    { slug: 'firmar', category: 'verb', priority: 2 },
    { slug: 'querer', category: 'verb', priority: 1 },
    { slug: 'poder', category: 'verb', priority: 1 },
    { slug: 'tener', category: 'verb', priority: 1 },
    { slug: 'ir', category: 'verb', priority: 2 },
    { slug: 'venir', category: 'verb', priority: 2 },
    { slug: 'hacer', category: 'verb', priority: 2 },
    { slug: 'decir', category: 'verb', priority: 2 },
    { slug: 'ver', category: 'verb', priority: 3 },
    { slug: 'entender', category: 'verb', priority: 2 },
    { slug: 'saber', category: 'verb', priority: 2 },

    // Context (15 words) - Places and objects
    { slug: 'cita', category: 'context', priority: 1 },
    { slug: 'credencial', category: 'context', priority: 1 },
    { slug: 'bano', category: 'context', priority: 1 },
    { slug: 'oficina', category: 'context', priority: 2 },
    { slug: 'hospital', category: 'context', priority: 1 },
    { slug: 'farmacia', category: 'context', priority: 2 },
    { slug: 'banco', category: 'context', priority: 2 },
    { slug: 'escuela', category: 'context', priority: 2 },
    { slug: 'casa', category: 'context', priority: 2 },
    { slug: 'trabajo', category: 'context', priority: 2 },
    { slug: 'doctor', category: 'context', priority: 1 },
    { slug: 'enfermera', category: 'context', priority: 2 },
    { slug: 'agua', category: 'context', priority: 1 },
    { slug: 'comida', category: 'context', priority: 2 },
    { slug: 'dinero', category: 'context', priority: 2 },

    // Questions (10 words) - Essential interrogatives
    { slug: 'que', category: 'question', priority: 1 },
    { slug: 'donde', category: 'question', priority: 1 },
    { slug: 'cuando', category: 'question', priority: 1 },
    { slug: 'quien', category: 'question', priority: 2 },
    { slug: 'como', category: 'question', priority: 1 },
    { slug: 'por_que', category: 'question', priority: 2 },
    { slug: 'cual', category: 'question', priority: 2 },
    { slug: 'cuanto', category: 'question', priority: 2 },
    { slug: 'cuantos', category: 'question', priority: 3 },
    { slug: 'para_que', category: 'question', priority: 3 },
];

async function main() {
    console.log('🌱 Starting database seeding...');

    // Upsert glossary items (create if not exists, skip if exists)
    for (const item of genesisGlossary) {
        await prisma.glossary.upsert({
            where: { slug: item.slug },
            update: {
                category: item.category,
                priority: item.priority,
            },
            create: {
                slug: item.slug,
                category: item.category,
                priority: item.priority,
            },
        });
    }

    const count = await prisma.glossary.count();
    console.log(`✅ Seeded ${count} glossary items`);

    // Display summary by category
    const categories = ['social', 'verb', 'context', 'question'];
    for (const category of categories) {
        const categoryCount = await prisma.glossary.count({
            where: { category },
        });
        console.log(`   - ${category}: ${categoryCount} words`);
    }
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error('❌ Seeding failed:', e);
        await prisma.$disconnect();
        process.exit(1);
    });
