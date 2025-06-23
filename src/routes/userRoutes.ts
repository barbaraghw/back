import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import passport from 'passport';
import User, { IUser } from '../models/User'; // Importa IUser y el modelo User
import bcrypt from 'bcryptjs';

const router: Router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) =>
        Promise.resolve(fn(req, res, next)).catch(next);

// Middleware para proteger las rutas (usando JwtStrategy)
const authenticateJWT: RequestHandler = (req, res, next) => {
    passport.authenticate('jwt', { session: false }, (err: Error, user: IUser | false, info: { message?: string }) => {
        if (err) {
            console.error('Error durante la autenticación JWT:', err);
            return next(err);
        }
        if (!user) {
            return res.status(401).json({ message: info?.message || 'No autorizado. Token inválido o expirado.' });
        }
        req.user = user; 
        next();
    })(req, res, next);
};

interface UpdateUserRequestBody {
    email?: string;
    password?: string;
    newPassword?: string;
}

interface DeleteUserRequestBody {
    password?: string;
}


// Ruta para obtener los datos del usuario actual (protegida)
router.get('/me', authenticateJWT, asyncHandler(async (req: Request, res: Response) => {
    const userDocument = req.user as IUser; // Afirmamos que req.user es un documento IUser
    
    if (!userDocument) { // Por si acaso req.user es null/undefined
        res.status(404).json({ message: 'Usuario no encontrado o no autenticado.' });
        return;
    }
    // Ahora accedemos a las propiedades del documento IUser
    res.status(200).json({ id: userDocument._id, email: userDocument.email });
}));

// Ruta para actualizar los datos del usuario (protegida)
router.put('/me', authenticateJWT, asyncHandler(async (req: Request<any, any, UpdateUserRequestBody>, res: Response) => {
    const authenticatedUser = req.user as IUser; // Afirmamos que req.user es un IUser
    if (!authenticatedUser?._id) {
        res.status(401).json({ message: 'Usuario no autenticado o ID de usuario no disponible.' });
        return;
    }

    const { email, password, newPassword } = req.body;
    
    // Al buscar con findById, el resultado es un Documento de Mongoose,
    // que es compatible con IUser, pero lo afirmamos para mayor claridad.
    const user = await User.findById(authenticatedUser._id) as IUser; 
    if (!user) {
        res.status(404).json({ message: 'Usuario no encontrado.' });
        return;
    }

    if (password) {
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            res.status(401).json({ message: 'Contraseña actual incorrecta.' });
            return;
        }
    } else {
        if ((email && email !== user.email) || newPassword) {
            res.status(400).json({ message: 'Se requiere la contraseña actual para actualizar el email o la contraseña.' });
            return;
        }
    }

    if (email && email !== user.email) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(409).json({ message: 'El nuevo email ya está en uso.' });
            return;
        }
        user.email = email;
    }

    if (newPassword) {
        if (password === newPassword) {
            res.status(400).json({ message: 'La nueva contraseña no puede ser igual a la actual.' });
            return;
        }
        user.password = newPassword;
    }

    await user.save();
    res.status(200).json({ message: 'Perfil actualizado exitosamente.', user: { id: user._id, email: user.email } });
}));

// Ruta para eliminar el usuario (protegida)
router.delete('/me', authenticateJWT, asyncHandler(async (req: Request<any, any, DeleteUserRequestBody>, res: Response) => {
    const authenticatedUser = req.user as IUser; // Afirmamos que req.user es un IUser
    if (!authenticatedUser?._id) {
        res.status(401).json({ message: 'Usuario no autenticado o ID de usuario no disponible.' });
        return;
    }

    const { password } = req.body;

    const user = await User.findById(authenticatedUser._id) as IUser; // Afirmamos que user es un IUser
    if (!user) {
        res.status(404).json({ message: 'Usuario no encontrado.' });
        return;
    }

    if (!password || !(await user.comparePassword(password))) {
        res.status(401).json({ message: 'Contraseña incorrecta. No se pudo eliminar la cuenta.' });
        return;
    }

    await User.findByIdAndDelete(authenticatedUser._id);
    res.status(200).json({ message: 'Cuenta eliminada exitosamente.' });
}));

export default router;