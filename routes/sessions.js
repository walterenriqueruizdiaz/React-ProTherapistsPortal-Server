const express = require('express');
const router = express.Router();
const prisma = require('../db');

const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ message: 'Unauthorized' });
};

// GET /api/sessions - List
router.get('/sessions', ensureAuthenticated, async (req, res) => {
    try {
        const sessions = await prisma.session.findMany({
            where: { professionalId: req.user.id },
            include: { patient: true, appointment: true },
            orderBy: { date: 'desc' }
        });
        res.json(sessions);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching sessions' });
    }
});

// GET /api/sessions/:id - Get single
router.get('/sessions/:id', ensureAuthenticated, async (req, res) => {
    try {
        const session = await prisma.session.findUnique({
            where: { id: req.params.id },
            include: { patient: true, appointment: true }
        });

        if (!session) return res.status(404).json({ message: 'Session not found' });
        if (session.professionalId !== req.user.id) return res.status(403).json({ message: 'Unauthorized' });

        res.json(session);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching session' });
    }
});

// POST /api/appointments/:id/session - Create Session from Appointment
router.post('/appointments/:id/session', ensureAuthenticated, async (req, res) => {
    try {
        const appointmentId = req.params.id;
        const { sessionType, notes } = req.body;

        // Verify appointment belongs to user
        const appointment = await prisma.appointment.findUnique({
            where: { id: appointmentId }
        });

        if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
        if (appointment.professionalId !== req.user.id) return res.status(403).json({ message: 'Unauthorized' });

        // Check if session already exists
        const existing = await prisma.session.findUnique({ where: { appointmentId } });
        if (existing) return res.status(400).json({ message: 'Session already exists for this appointment' });

        // Create session
        const newSession = await prisma.session.create({
            data: {
                appointmentId,
                professionalId: req.user.id,
                patientId: appointment.patientId,
                date: appointment.dateTime,
                time: appointment.dateTime,
                sessionType,
                notes
            }
        });

        // Update appointment status to CONFIRMADO
        await prisma.appointment.update({
            where: { id: appointmentId },
            data: { status: 'CONFIRMADO' }
        });

        res.json(newSession);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error creating session' });
    }
});

// PUT /api/sessions/:id - Update
router.put('/sessions/:id', ensureAuthenticated, async (req, res) => {
    try {
        const { sessionType, notes } = req.body;

        // Check ownership
        const session = await prisma.session.findUnique({
            where: { id: req.params.id }
        });

        if (!session) return res.status(404).json({ message: 'Session not found' });
        if (session.professionalId !== req.user.id) return res.status(403).json({ message: 'Unauthorized' });

        const updated = await prisma.session.update({
            where: { id: req.params.id },
            data: { sessionType, notes }
        });

        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error updating session' });
    }
});

// DELETE /api/sessions/:id - Delete
router.delete('/sessions/:id', ensureAuthenticated, async (req, res) => {
    try {
        const sessionId = req.params.id;

        // Check ownership
        const session = await prisma.session.findUnique({
            where: { id: sessionId }
        });

        if (!session) return res.status(404).json({ message: 'Session not found' });
        if (session.professionalId !== req.user.id) return res.status(403).json({ message: 'Unauthorized' });

        await prisma.session.delete({
            where: { id: sessionId }
        });

        res.json({ message: 'Session deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error deleting session' });
    }
});

module.exports = router;
