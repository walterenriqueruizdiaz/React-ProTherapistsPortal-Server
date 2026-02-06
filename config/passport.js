const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const prisma = require('../db');

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        // Check if user is Professional or just User (Auth)
        // In our schema, we only have Professional linked to User concept via userId, 
        // BUT the schema I defined has Professional.userId, Professional.email.
        // Wait, the schema I defined merged Auth into Professional mostly?
        // "Professional ... userId String @unique // Google Subject / User ID"
        // "Professional ... email String @unique"

        // So 'user' in passport should be the Professional record if possible.
        const professional = await prisma.professional.findUnique({
            where: { id }
        });

        if (professional) {
            done(null, professional);
        } else {
            // If searching by googleId fails (wait, we deserialize by ID)
            // If not found by ID, maybe error?
            // Note: verify callback returns the user object.
            done(null, null);
        }
    } catch (err) {
        done(err, null);
    }
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.OAUTH_CALLBACK_URL || (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/auth/google/callback` : 'http://localhost:3000/api/auth/google/callback'),
    passReqToCallback: true
},
    async (req, accessToken, refreshToken, profile, done) => {
        try {
            console.log('Google Auth strategy triggered for profile:', profile.id);
            const googleId = profile.id;
            const email = profile.emails?.[0]?.value;
            console.log('Attempting login/creation for email:', email);
            const firstName = profile.name.givenName;
            const lastName = profile.name.familyName;

            // Find or create Professional
            // Note: First time login creates a record. 
            // The requirement says: "After the first successful Google login, if there is no Professional record... redirect to Complete Profile"
            // So we should create a stub Professional or just find one.

            let professional = await prisma.professional.findUnique({
                where: { userId: googleId }
            });

            if (!professional) {
                // Check if email exists to merge? Or just create new.
                // For security, matching by email is okay if email is verified. Google emails are.
                professional = await prisma.professional.findUnique({
                    where: { email: email }
                });

                if (professional) {
                    // Link googleId
                    professional = await prisma.professional.update({
                        where: { email: email },
                        data: { userId: googleId }
                    });
                } else {
                    // Create new partial professional
                    professional = await prisma.professional.create({
                        data: {
                            userId: googleId,
                            email: email,
                            firstName: firstName, // Pre-fill
                            lastName: lastName,   // Pre-fill
                            // other fields null
                        }
                    });
                }
            }

            if (!professional.isActive) {
                return done(null, false, { message: 'Tu cuenta ha sido desactivada. Contacta al administrador.' });
            }

            return done(null, professional);
        } catch (err) {
            return done(err, null);
        }
    }
));

module.exports = passport;
