const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Testing Prisma connection...');
        const professionals = await prisma.professional.findMany();
        console.log('SUCCESS: Found', professionals.length, 'professionals');
    } catch (err) {
        console.error('DATABASE ERROR:', err);
        if (err.code) console.log('Error Code:', err.code);
        if (err.meta) console.log('Error Meta:', err.meta);
    } finally {
        await prisma.$disconnect();
    }
}

main();
