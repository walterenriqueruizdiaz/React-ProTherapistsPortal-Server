const express = require('express');
const router = express.Router();
const prisma = require('../db');

const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ message: 'Unauthorized' });
};

// GET /api/patients - List all patients (Search by DNI/Lastname)
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const { search } = req.query;
        const where = {};

        if (search) {
            where.OR = [
                { dni: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } }
            ];
        }

        const patients = await prisma.patient.findMany({
            where,
            orderBy: { lastName: 'asc' }
        });
        res.json(patients);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching patients' });
    }
});

// GET /api/patients/:id - Detail
router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const patient = await prisma.patient.findUnique({
            where: { id: req.params.id },
            include: { familyContacts: true, appointments: true, sessions: true }
        });
        if (!patient) return res.status(404).json({ message: 'Patient not found' });
        res.json(patient);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching patient' });
    }
});

// POST /api/patients - Create
router.post('/', ensureAuthenticated, async (req, res) => {
    try {
        console.log("POST /api/patients - Data received:", req.body);
        const { dni, firstName, lastName, birthDate, mobilePhone, email } = req.body;

        if (!dni || !firstName || !lastName || !birthDate || !mobilePhone) {
            console.warn("POST /api/patients - Missing required fields");
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Check if exists
        const existing = await prisma.patient.findUnique({ where: { dni } });
        if (existing) {
            console.warn(`POST /api/patients - Patient with DNI ${dni} already exists`);
            return res.status(400).json({ message: 'Patient with this DNI already exists' });
        }

        const newPatient = await prisma.patient.create({
            data: {
                dni,
                firstName,
                lastName,
                birthDate: new Date(birthDate),
                mobilePhone,
                email
            }
        });
        console.log("POST /api/patients - Success:", newPatient.id);
        res.json(newPatient);
    } catch (err) {
        console.error("POST /api/patients - Error:", err);
        res.status(500).json({ error: 'Error creating patient', message: err.message });
    }
});

// PUT /api/patients/:id
router.put('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const { dni, firstName, lastName, birthDate, mobilePhone, email } = req.body;
        const updated = await prisma.patient.update({
            where: { id: req.params.id },
            data: {
                dni, firstName, lastName,
                birthDate: new Date(birthDate),
                mobilePhone, email
            }
        });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: 'Error updating patient' });
    }
});

// DELETE /api/patients/:id
router.delete('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const patientId = req.params.id;

        // Check for existing appointments
        const appointmentCount = await prisma.appointment.count({
            where: { patientId }
        });

        if (appointmentCount > 0) {
            return res.status(400).json({
                message: 'No se puede eliminar el paciente porque tiene turnos asignados. Elimine primero los turnos.'
            });
        }

        await prisma.patient.delete({ where: { id: patientId } });
        res.json({ message: 'Paciente eliminado correctamente' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al eliminar el paciente' });
    }
});

// GET /api/patients/:id/contacts - List contacts for a patient
router.get('/:id/contacts', ensureAuthenticated, async (req, res) => {
    try {
        const contacts = await prisma.familyContact.findMany({
            where: { patientId: req.params.id }
        });
        res.json(contacts);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching contacts' });
    }
});

// POST /api/patients/:id/contacts - Create contact
router.post('/:id/contacts', ensureAuthenticated, async (req, res) => {
    try {
        const { firstName, lastName, relationshipToPatient, mobilePhone, email } = req.body;
        const contact = await prisma.familyContact.create({
            data: {
                patientId: req.params.id,
                firstName, lastName, relationshipToPatient, mobilePhone, email
            }
        });
        res.json(contact);
    } catch (err) {
        res.status(500).json({ error: 'Error creating contact' });
    }
});

// PUT /api/patients/contacts/:contactId - Update contact
router.put('/contacts/:contactId', ensureAuthenticated, async (req, res) => {
    try {
        const { firstName, lastName, relationshipToPatient, mobilePhone, email } = req.body;
        const updated = await prisma.familyContact.update({
            where: { id: req.params.contactId },
            data: { firstName, lastName, relationshipToPatient, mobilePhone, email }
        });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: 'Error updating contact' });
    }
});

// DELETE /api/patients/contacts/:contactId - Delete contact
router.delete('/contacts/:contactId', ensureAuthenticated, async (req, res) => {
    try {
        await prisma.familyContact.delete({
            where: { id: req.params.contactId }
        });
        res.json({ message: 'Contact deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error deleting contact' });
    }
});

module.exports = router;
