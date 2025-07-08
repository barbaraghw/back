import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import passport from 'passport';
import User, { IUser } from '../models/User'; // Importa IUser y el modelo User
import bcrypt from 'bcryptjs';

const router: Router = Router();

// Definir los límites de caracteres para consistencia
const MIN_LENGTH_PASSWORD = 3;
const MIN_LENGTH_USERNAME = 3;
const MAX_LENGTH_USERNAME = 30;
const MIN_LENGTH_EMAIL = 5;
const MAX_LENGTH_EMAIL = 50;

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
    password?: string; // Contraseña actual para verificación
    newPassword?: string; // Nueva contraseña a establecer
    username?: string; // Permitir actualización de username
}

interface DeleteUserRequestBody {
    password?: string;
}


// Ruta para obtener los datos del usuario actual (protegida)
router.get('/me', authenticateJWT, asyncHandler(async (req: Request, res: Response) => {
    const userDocument = req.user as IUser; 
    
    if (!userDocument) {
        res.status(404).json({ message: 'Usuario no encontrado o no autenticado.' });
        return;
    }
    // Incluir username en la respuesta del perfil
    res.status(200).json({ id: userDocument._id, email: userDocument.email, username: userDocument.username, isCritic: userDocument.isCritic });
}));

// Ruta para actualizar los datos del usuario (protegida)
router.put('/me', authenticateJWT, asyncHandler(async (req: Request<any, any, UpdateUserRequestBody>, res: Response) => {
    const authenticatedUser = req.user as IUser; 
    if (!authenticatedUser?._id) {
        res.status(401).json({ message: 'Usuario no autenticado o ID de usuario no disponible.' });
        return;
    }

    const { email, password, newPassword, username } = req.body;
    
    // Al buscar con findById, el resultado es un Documento de Mongoose,
    // y seleccionamos la contraseña explícitamente para compararla.
    const user = await User.findById(authenticatedUser._id).select('+password') as IUser; 
    if (!user) {
        res.status(404).json({ message: 'Usuario no encontrado.' });
        return;
    }

    // Validar contraseña actual si se intenta actualizar email, username o newPassword
    if ((email !== undefined && email !== user.email) || (username !== undefined && username !== user.username) || newPassword) {
        if (!password) {
            res.status(400).json({ message: 'Se requiere la contraseña actual para actualizar el email, nombre de usuario o la contraseña.' });
            return;
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            res.status(401).json({ message: 'Contraseña actual incorrecta.' });
            return;
        }
    }

    if (email !== undefined) {
        // **** VALIDACIÓN DE LONGITUD Y FORMATO DE EMAIL ****
        if (email.length < MIN_LENGTH_EMAIL || email.length > MAX_LENGTH_EMAIL) {
            res.status(400).json({ message: `El email debe tener entre ${MIN_LENGTH_EMAIL} y ${MAX_LENGTH_EMAIL} caracteres.` });
            return;
        }
        if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
            res.status(400).json({ message: 'Por favor, introduce un email válido.' });
            return;
        }
        // **** FIN VALIDACIÓN EMAIL ****

        if (email !== user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                res.status(409).json({ message: 'El nuevo email ya está en uso.' });
                return;
            }
            user.email = email;
        }
    }

    if (username !== undefined) {
        // **** VALIDACIÓN DE LONGITUD DE USERNAME ****
        if (username.length < MIN_LENGTH_USERNAME || username.length > MAX_LENGTH_USERNAME) {
            res.status(400).json({ message: `El nombre de usuario debe tener entre ${MIN_LENGTH_USERNAME} y ${MAX_LENGTH_USERNAME} caracteres.` });
            return;
        }
        // **** FIN VALIDACIÓN USERNAME ****

        if (username !== user.username) {
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                res.status(409).json({ message: 'El nuevo nombre de usuario ya está en uso.' });
                return;
            }
            user.username = username;
        }
    }

    if (newPassword !== undefined) { 

        if (password === newPassword) { // Comparar con la contraseña ACTUAL (que se pasó en el body)
            res.status(400).json({ message: 'La nueva contraseña no puede ser igual a la actual.' });
            return;
        }
        user.password = newPassword; // Mongoose hasheará esto en el hook pre-save
    }

    try {
        await user.save();
        // Excluir la contraseña en la respuesta
        res.status(200).json({ message: 'Perfil actualizado exitosamente.', user: { id: user._id, email: user.email, username: user.username, isCritic: user.isCritic } });
    } catch (error: any) {
        // Capturar errores de validación de Mongoose si aún así se producen (e.g. unique field constraint)
        if (error.name === 'MongoServerError' && error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            const value = error.keyValue[field];
            if (field === 'email') {
                res.status(409).json({ message: `El email '${value}' ya está en uso.` });
            } else if (field === 'username') {
                res.status(409).json({ message: `El nombre de usuario '${value}' ya está en uso.` });
            } else {
                res.status(409).json({ message: `Valor duplicado para el campo ${field}: ${value}.` });
            }
            return;
        }
        console.error('Error al guardar el usuario:', error);
        res.status(500).json({ message: 'Error del servidor al actualizar el perfil.' });
    }
}));

// Ruta para eliminar el usuario (protegida)
router.delete('/me', authenticateJWT, asyncHandler(async (req: Request<any, any, DeleteUserRequestBody>, res: Response) => {
    const authenticatedUser = req.user as IUser; 
    if (!authenticatedUser?._id) {
        res.status(401).json({ message: 'Usuario no autenticado o ID de usuario no disponible.' });
        return;
    }

    const { password } = req.body;

    const user = await User.findById(authenticatedUser._id).select('+password') as IUser; 
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