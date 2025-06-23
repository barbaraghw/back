import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import User from '../models/User'; // Asume que tienes un modelo de usuario
import dotenv from 'dotenv';
import express from 'express'

dotenv.config();

const app = express();

app.use(express.json());
app.use(passport.initialize()); 

// Estrategia Local (para registro y login con email/password)
passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
}, async (email, password, done) => {
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return done(null, false, { message: 'Credenciales incorrectas.' });
        }
        const isMatch = await user.comparePassword(password); // Método en tu modelo de usuario
        if (!isMatch) {
            return done(null, false, { message: 'Credenciales incorrectas.' });
        }
        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));

// Estrategia JWT (para proteger rutas con token)
passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET || 'fallback_secret'
}, async (jwtPayload, done) => {
    try {
        const user = await User.findById(jwtPayload.id);
        if (!user) {
            return done(null, false);
        }
        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));

export default passport; // No es necesario exportarlo si solo se importa en app.ts