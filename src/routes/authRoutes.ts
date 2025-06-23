import { Router, Request, Response, NextFunction, RequestHandler } from 'express'; 
import passport from 'passport';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User, { IUser } from '../models/User';

dotenv.config();

const router: Router = Router();

// Define una interfaz para el cuerpo de la petición de registro
interface RegisterRequestBody {
  email: string;
  password: string;
}
interface LoginRequestBody {
  email: string;
  password: string;
}
// Ruta de registro usando el tipo RequestHandler para mayor claridad
router.post('/register', (async (req: Request<any, any, RegisterRequestBody>, res: Response) => {
    try {
        const { email, password } = req.body;
        const newUser = new User({ email, password });
        await newUser.save();
        res.status(201).json({ message: 'Usuario registrado exitosamente.' });
    } catch (error: any) {
        if (error.code === 11000) {
            return res.status(409).json({ message: 'El email ya está registrado.' });
        }
        res.status(500).json({ message: 'Error al registrar usuario.', error: error.message });
    }
}) as RequestHandler<any, any, RegisterRequestBody>); // Aplica RequestHandler explícitamente aquí

router.post('/login', (
    req: Request<any, any, LoginRequestBody>,
    res: Response,
    next: NextFunction
) => {
    console.log('¡Petición de login recibida en authRoutes!'); // <--- AÑADE ESTA LÍNEA

    passport.authenticate('local', { session: false }, (err: Error, user: IUser, info: { message?: string }) => {
        if (err) {
            console.error('Error de Passport en callback:', err); // <--- AÑADE ESTA LÍNEA
            return next(err);
        }
        if (!user) {
            console.log('Autenticación fallida: usuario no encontrado o credenciales inválidas.'); // <--- AÑADE ESTA LÍNEA
            return res.status(401).json({ message: info.message || 'Credenciales inválidas.' });
        }

        req.login(user, { session: false }, (err: Error | undefined) => {
            if (err) {
                console.error('Error en req.login:', err); // <--- AÑADE ESTA LÍNEA
                return next(err);
            }

            const secret = process.env.JWT_SECRET;
            if (!secret) {
                console.error('JWT_SECRET no está definido en las variables de entorno.');
                return res.status(500).json({ message: 'Error de configuración del servidor.' });
            }

            const token = jwt.sign({ id: user._id, email: user.email }, secret, { expiresIn: '1h' });
            console.log('Login exitoso, token generado.'); // <--- AÑADE ESTA LÍNEA
            return res.json({ user: { id: user._id, email: user.email }, token });
        });
    })(req, res, next);
});

export default router;