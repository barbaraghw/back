// src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import passport from 'passport'; // Import passport instance
import { IUser } from '../models/User'; // Import IUser for proper typing
import AppError from '../utils/AppError'; // Import your custom AppError for consistent error handling

/**
 * Middleware to authenticate requests using JWT strategy.
 * Attaches the authenticated user (IUser) to req.user.
 * Handles authentication errors by passing them to the global error handler.
 */
export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('jwt', { session: false }, (err: Error, user: IUser | false, info: { message?: string }) => {
        if (err) {
            // If there's an internal error during authentication (e.g., database error in strategy)
            console.error('Error during JWT authentication:', err);
            return next(err); // Pass to global error handler
        }
        if (!user) {
            // If authentication fails (no token, invalid token, user not found)
            const errorMessage = info?.message || 'No autorizado. Token inválido o expirado.';
            return next(new AppError(errorMessage, 401)); // Use AppError for consistent response
        }
        // If authentication is successful, attach the user object to the request.
        // Thanks to src/types/express.d.ts, TypeScript knows req.user is IUser.
        req.user = user;
        next(); // Proceed to the next middleware/route handler
    })(req, res, next); // Ensure the passport.authenticate function is called with req, res, next
};