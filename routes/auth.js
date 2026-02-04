const express = require('express');
const passport = require('passport');
const router = express.Router();

// Logic to determine redirect
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
    (req, res, next) => {
        passport.authenticate('google', (err, user, info) => {
            if (err) {
                console.error('OAUTH AUTHENTICATION ERROR:', err);
                return res.status(500).json({ message: 'Auth Error', details: err.message, info });
            }
            if (!user) {
                console.warn('OAUTH LOGIN FAILED:', info);
                return res.status(401).json({ message: 'Login failed', details: info?.message || 'Bad Request' });
            }
            req.logIn(user, (loginErr) => {
                if (loginErr) return next(loginErr);

                // Successful authentication logic
                if (!user.dni || !user.professionalLicenseNumber) {
                    return res.redirect(`${CLIENT_URL}/complete-profile`);
                } else {
                    return res.redirect(`${CLIENT_URL}/dashboard`);
                }
            });
        })(req, res, next);
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
