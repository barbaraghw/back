// src/routes/commentRoutes.ts
import { Router, Request, Response, NextFunction } from 'express'; // Asegúrate de importar NextFunction
import { authenticateJWT } from '../middleware/authMiddleware'; // Importamos el middleware centralizado
import {
    createComment,
    getCommentsForMovie,
    updateComment,
    deleteComment,
    getCommentById,
    getRatingsForMovie,
} from '../controllers/commentController';

const router: Router = Router();

// Define el asyncHandler aquí o impórtalo de un archivo de utilidades si lo usas en muchos lugares.
// Por ahora, lo definimos aquí para que se parezca al de movieRoutes.ts.
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next); // This is correct, it only calls next on error.
    };
// Rutas GET (lectura) - Ordenar de más específica a más genérica
// Ahora envueltas en asyncHandler
router.get('/:id', asyncHandler(getCommentById));
router.get('/ratings/:movieId', asyncHandler(getRatingsForMovie));
router.get('/movie/:movieId', asyncHandler(getCommentsForMovie));

// Rutas Privadas (authentication required)
// Ahora envueltas en asyncHandler (si los controladores son async)
router.post('/', authenticateJWT, asyncHandler(createComment));
router.put('/:id', authenticateJWT, asyncHandler(updateComment));
router.delete('/:id', authenticateJWT, asyncHandler(deleteComment));

export default router;