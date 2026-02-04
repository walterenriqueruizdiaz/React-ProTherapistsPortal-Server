const express = require('express');
const passport = require('passport');
const router = express.Router();

// Logic to determine redirect
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login/failed' }),
    (req, res) => {
        // Successful authentication
        // Check if profile is complete. 
        // DNI and License are required.
        const user = req.user;
        if (!user.dni || !user.professionalLicenseNumber) {
            res.redirect(`${CLIENT_URL}/complete-profile`);
        } else {
            res.redirect(`${CLIENT_URL}/dashboard`);
        }
    }
);

router.get('/me', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            authenticated: true,
            user: req.user
        });
    } else {
        res.status(401).json({ authenticated: false });
    }
});

router.post('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.status(200).json({ message: 'Logged out' });
    });
});

module.exports = router;
