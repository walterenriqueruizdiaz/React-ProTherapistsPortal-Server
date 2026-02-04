const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { addWeeks, addMonths, isAfter, endOfYear, parseISO, startOfWeek, endOfWeek } = require('date-fns');

const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ message: 'Unauthorized' });
};

// GET /api/appointments - List with filters (e.g., week)
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        // Basic filter by date range if provided, otherwise all or limit
        const where = {
            professionalId: req.user.id
        };

        if (startDate && endDate) {
            where.dateTime = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        } else if (req.query.today === 'true') {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);
            where.dateTime = {
                gte: startOfDay,
                lte: endOfDay
            };
        }

        const appointments = await prisma.appointment.findMany({
            where,
            include: { patient: true, session: true }, // Include patient info and if session exists
            orderBy: { dateTime: 'asc' }
        });
        res.json(appointments);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching appointments' });
    }
});

// GET /api/appointments/week
router.get('/week', ensureAuthenticated, async (req, res) => {
    try {
        const { date } = req.query; // Date within the week
        const targetDate = date ? new Date(date) : new Date();

        const start = startOfWeek(targetDate, { weekStartsOn: 1 }); // Monday start
        const end = endOfWeek(targetDate, { weekStartsOn: 1 });

        const appointments = await prisma.appointment.findMany({
            where: {
                professionalId: req.user.id,
                dateTime: {
                    gte: start,
                    lte: end
                }
            },
            include: { patient: true, session: true },
            orderBy: { dateTime: 'asc' }
        });
        res.json(appointments);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching weekly appointments' });
    }
});

// GET /api/appointments/stats
router.get('/stats', ensureAuthenticated, async (req, res) => {
    try {
        const total = await prisma.appointment.count({
            where: { professionalId: req.user.id }
        });

        const completed = await prisma.session.count({
            where: { professionalId: req.user.id }
        });

        res.json({ total, completed, cancelled: 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching stats' });
    }
});


// POST /api/appointments - Create (with recurrence)
router.post('/', ensureAuthenticated, async (req, res) => {
    try {
        const { patientId, dateTime, recurrence, status } = req.body;

        // Validate required
        if (!patientId || !dateTime) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const startDateTime = new Date(dateTime);
        if (isNaN(startDateTime.getTime())) {
            return res.status(400).json({ message: 'Invalid date/time format' });
        }

        const limitDate = endOfYear(new Date()); // Last moment of current year

        let appointmentsToCreate = [];

        // Initial appointment
        appointmentsToCreate.push({
            professionalId: req.user.id,
            patientId,
            dateTime: startDateTime,
            recurrence: recurrence || 'NONE',
            status: status || 'RESERVADO'
        });

        if (recurrence === 'WEEKLY') {
            let nextDate = addWeeks(startDateTime, 1);
            while (!isAfter(nextDate, limitDate)) {
                appointmentsToCreate.push({
                    professionalId: req.user.id,
                    patientId,
                    dateTime: nextDate,
                    recurrence: 'WEEKLY', // Mark subsequent ones as part of recurrence too
                    status: 'RESERVADO' // Default for future
                });
                nextDate = addWeeks(nextDate, 1);
            }
        } else if (recurrence === 'MONTHLY') {
            let nextDate = addMonths(startDateTime, 1);
            while (!isAfter(nextDate, limitDate)) {
                appointmentsToCreate.push({
                    professionalId: req.user.id,
                    patientId,
                    dateTime: nextDate,
                    recurrence: 'MONTHLY',
                    status: 'RESERVADO'
                });
                nextDate = addMonths(nextDate, 1);
            }
        }

        // Batch create
        console.log("Creating appointments:", JSON.stringify(appointmentsToCreate, null, 2));
        const result = await prisma.appointment.createMany({
            data: appointmentsToCreate
        });

        res.json({ message: 'Appointments created', count: result.count });

    } catch (err) {
        console.error("CRITICAL ERROR creating appointments:", err);
        res.status(500).json({ error: 'Error creating appointments', details: err.message });
    }
});

// GET /api/appointments/:id
router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const appointment = await prisma.appointment.findFirst({
            where: {
                id: req.params.id,
                professionalId: req.user.id
            },
            include: { patient: true }
        });
        if (!appointment) return res.status(404).json({ message: 'Not found' });
        res.json(appointment);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching appointment' });
    }
});

// PUT /api/appointments/:id - Update
router.put('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const { patientId, dateTime, status } = req.body;
        const appointmentId = req.params.id;

        // Verify ownership
        const existing = await prisma.appointment.findFirst({
            where: { id: appointmentId, professionalId: req.user.id }
        });

        if (!existing) return res.status(404).json({ message: 'Appointment not found' });

        const updated = await prisma.appointment.update({
            where: { id: appointmentId },
            data: {
                patientId: patientId || existing.patientId,
                dateTime: dateTime ? new Date(dateTime) : existing.dateTime,
                status: status || existing.status
            }
        });

        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error updating appointment' });
    }
});

// DELETE /api/appointments/:id - Delete
router.delete('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const appointmentId = req.params.id;

        // Verify ownership
        const existing = await prisma.appointment.findFirst({
            where: { id: appointmentId, professionalId: req.user.id }
        });

        if (!existing) return res.status(404).json({ message: 'Appointment not found' });

        await prisma.appointment.delete({
            where: { id: appointmentId }
        });

        res.json({ message: 'Appointment deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error deleting appointment' });
    }
});

module.exports = router;
