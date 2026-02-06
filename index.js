const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const passport = require('passport');
const dotenv = require('dotenv');
const fs = require('fs');

// Log unhandled errors
process.on('uncaughtException', (err) => {
    fs.writeFileSync('crash.log', err.stack || err.toString());
    process.exit(1);
});

dotenv.config();

const app = express();
app.set('trust proxy', 1); // Trust first proxy for secure cookies on Railway
const PORT = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
    console.error('CRITICAL ERROR: DATABASE_URL environment variable is not set.');
}

const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(session({
    store: new pgSession({
        pool: pgPool,
        tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET || 'fallback-secret-key',
    resave: false,
    saveUninitialized: false,
    proxy: true, // Required for secure cookies behind reverse proxy
    cookie: {
        secure: true, // Required for sameSite: 'none' and Railway proxy
        httpOnly: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Passport Config
require('./config/passport');

const authRoutes = require('./routes/auth');
const professionalRoutes = require('./routes/professionals');
const patientRoutes = require('./routes/patients');
const appointmentRoutes = require('./routes/appointments');
const sessionRoutes = require('./routes/sessions');
const adminRoutes = require('./routes/admin');

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Auth: ${req.isAuthenticated()} - SessionID: ${req.sessionID}`);
    if (req.user) console.log('Current User ID:', req.user.id);
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/professionals', professionalRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
// Note: Sessions has a root route AND a nested route in appointments. 
// My sessions.js defines router.get('/') and router.post('/appointments/:id/session')
// The latter means if I mount at '/api', I get '/api/appointments/:id/session'.
// But I also want '/api/sessions'.
// Let's mount sessions router at '/api' to catch both if defined that way?
// Wait, my sessions.js has `router.get('/', ...)` -> this would be `/api/sessions/` if mounted at `/api/sessions`.
// And `router.post('/appointments/:id/session')` -> this would be `/api/sessions/appointments/:id/session` if mounted at `/api/sessions`. That's ugly.
// Better: Mount at '/api' and change sessions.js routes?
// OR: Mount sessions routes separately.
// Let's look at sessions.js content again. 
// It has `router.get('/')` and `router.post('/appointments/:id/session')`.
// If I mount `sessionRoutes` at `/api`, then `get('/')` becomes `/api/`. That's wrong.
// If I mount `sessionRoutes` at `/api/sessions`, `get('/')` works. But `post` becomes `/api/sessions/appointments...`
// FIX: I will mount it at `/api` and change the `get('/')` in `sessions.js` to `get('/sessions')`.
// Actually, easier to simple modify index.js to use it twice or just use logic.
// I'll modify `sessions.js` in the next step to be cleaner.
// consistently:
// app.use('/api/sessions', sessionRoutes); -> Handles listing
// The creation route `/api/appointments/:id/session` logic is distinct.
// I will just add the creation route to `appointments.js`?
// No, keep separation.
// Let's just mount it at `/api` and have `sessions.js` define full paths.
app.use('/api', sessionRoutes);
app.use('/api/admin', adminRoutes);

// app.get('/', (req, res) => {
//     res.send('Pro Therapists Portal API is running');
// });

// Serve static files from 'public' and 'assets'
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Catch-all route for SPA support
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error('SERVER ERROR:', err);
    res.status(500).json({
        message: 'Internal Server Error',
        details: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} (bound to 0.0.0.0)`);
    console.log(`BACKEND_URL configured as: ${process.env.BACKEND_URL}`);
    console.log(`CLIENT_URL configured as: ${process.env.CLIENT_URL}`);
    // Keep alive log
    setInterval(() => {
        console.log(`${new Date().toISOString()} - Server is still running on port ${PORT}`);
    }, 60000);
});
