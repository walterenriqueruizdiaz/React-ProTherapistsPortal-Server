const { PrismaClient } = require('@prisma/client');

// Initialize Prisma Client with the DATABASE_URL from .env
const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
    log: ['error', 'warn']
});

if (!process.env.DATABASE_URL) {
    console.warn('WARNING: DATABASE_URL not found in environment variables. Prisma will look for it in the schema.');
}

module.exports = prisma;
