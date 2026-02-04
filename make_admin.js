const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

// CONFIGURATION: Replace with the email of the user you want to make ADMIN
const ADMIN_EMAIL = 'walter.enrique.ruiz.diaz@gmail.com';

async function makeAdmin() {
    try {
        console.log(`Buscando usuario con email: ${ADMIN_EMAIL}...`);

        const professional = await prisma.professional.findUnique({
            where: { email: ADMIN_EMAIL }
        });

        if (!professional) {
            console.error(`ERROR: No se encontró ningún profesional con el email ${ADMIN_EMAIL}.`);
            console.log('Asegúrate de haber iniciado sesión con Google al menos una vez para que el registro exista.');
            return;
        }

        const updated = await prisma.professional.update({
            where: { email: ADMIN_EMAIL },
            data: {
                role: 'ADMIN',
                isActive: true // Asegurar que sea activo
            }
        });

        console.log('¡ÉXITO!');
        console.log(`El usuario ${updated.firstName} ${updated.lastName} ahora es ADMINISTRADOR.`);
        console.log('Reinicia tu sesión en la aplicación para ver los cambios.');

    } catch (err) {
        console.error('Error al ejecutar el bootstrap:', err);
    } finally {
        await prisma.$disconnect();
    }
}

makeAdmin();
