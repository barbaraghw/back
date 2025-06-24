// src/config/passport.ts
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import User, { IUser } from '../models/User'; // Import IUser and your User model
import dotenv from 'dotenv';

dotenv.config();

// Estrategia Local (para registro y login con email/password)
passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
}, async (email, password, done) => {
    try {
        const user = await User.findOne({ email });
        if (!user) {
            // Pass false and a message for incorrect credentials
            return done(null, false, { message: 'Credenciales incorrectas.' });
        }
        // Ensure user is correctly typed as IUser for comparePassword method
        const isMatch = await (user as IUser).comparePassword(password);
        if (!isMatch) {
            return done(null, false, { message: 'Credenciales incorrectas.' });
        }
        // When authentication is successful, return the user document (typed as IUser)
        return done(null, user as IUser);
    } catch (err: any) { // Catch any unexpected errors
        return done(err);
    }
}));

// Estrategia JWT (para proteger rutas con token)
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
    // It's good practice to throw an error if a critical env var is missing
    console.error('JWT_SECRET is not defined in environment variables. Using a fallback, but this is not secure for production.');
    // In production, you might want to process.exit(1) or throw an actual error.
}

passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: jwtSecret || 'fallback_secret', // Use fallback if not defined (for dev, but warn)
}, async (jwtPayload, done) => {
    try {
        // Find user by ID from JWT payload
        const user = await User.findById(jwtPayload.id);
        if (!user) {
            // User not found for this ID
            return done(null, false);
        }
        // Return the full Mongoose user document
        return done(null, user as IUser); // Explicitly cast to IUser
    } catch (err: any) { // Catch any unexpected errors
        return done(err);
    }
}));

// This file doesn't export the passport instance directly if it's only imported for side effects
// (i.e., just to run the passport.use calls).
// If you need to access 'passport' object directly in other files, you can export it:
// export default passport;
// But typically, just importing it in app.ts is enough to set up strategies.