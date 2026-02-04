const express = require('express');
const router = express.Router();
const prisma = require('../db');

// Middleware to ensure user is authenticated and is an admin
const ensureAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === 'ADMIN') {
        return next();
    }
    res.status(403).json({ message: 'No tienes permisos para acceder a esta sección.' });
};

// GET all professionals
router.get('/professionals', ensureAdmin, async (req, res) => {
    try {
        const professionals = await prisma.professional.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(professionals);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener profesionales' });
    }
});

// PATCH toggle professional status
router.patch('/professionals/:id/toggle-status', ensureAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const professional = await prisma.professional.findUnique({
            where: { id }
        });

        if (!professional) {
            return res.status(404).json({ message: 'Profesional no encontrado' });
        }

        // Prevent admin from deactivating themselves
        if (professional.id === req.user.id) {
            return res.status(400).json({ message: 'No puedes desactivar tu propia cuenta.' });
        }

        const updated = await prisma.professional.update({
            where: { id },
            data: { isActive: !professional.isActive }
        });

        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al actualizar estado' });
    }
});

module.exports = router;
