const express = require('express');
const router = express.Router();
const prisma = require('../db');

// Middleware to ensure user is logged in
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ message: 'Unauthorized' });
};

// GET /api/professionals/me
router.get('/me', ensureAuthenticated, async (req, res) => {
    try {
        const professional = await prisma.professional.findUnique({
            where: { userId: req.user.userId } // req.user likely has the Professional fields if using our updated strategy
        });

        // Fallback if req.user is just the partial object from passport session
        if (!professional && req.user.id) {
            const prof = await prisma.professional.findUnique({ where: { id: req.user.id } });
            return res.json(prof);
        }

        res.json(professional || req.user);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/professionals/me
router.put('/me', ensureAuthenticated, async (req, res) => {
    try {
        const { firstName, lastName, dni, professionalLicenseNumber } = req.body;

        const updatedProfessional = await prisma.professional.update({
            where: { id: req.user.id },
            data: {
                firstName,
                lastName,
                dni,
                professionalLicenseNumber
            }
        });

        res.json(updatedProfessional);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error updating profile' });
    }
});

module.exports = router;
