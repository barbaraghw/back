// src/routes/movieRoutes.ts
import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import Movie, { IMovie } from '../models/Movie';
import { SortOrder } from 'mongoose'; // Importa SortOrder de mongoose
import passport from 'passport'; // Para proteger la ruta si es necesario

const router: Router = Router();

// === Async Handler para manejar errores en rutas async ===
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) =>
        Promise.resolve(fn(req, res, next)).catch(next);
// =========================================================

// Middleware para proteger las rutas (usando JwtStrategy)
// Lo usaremos aquí para asegurar que solo usuarios autenticados puedan acceder al listado
const authenticateJWT: RequestHandler = (req, res, next) => {
    passport.authenticate('jwt', { session: false }, (err: Error, user: any, info: { message?: string }) => {
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

// Ruta para obtener películas con filtros y ordenamiento
// GET /api/movies?search=query&genreId=12,28&minRating=7&startYear=2020&endYear=2023&sortBy=release_date&order=desc
router.get('/', authenticateJWT, asyncHandler(async (req: Request, res: Response) => {
    const {
        search,        // Búsqueda por título (parcial)
        genreId,       // Filtrar por uno o más IDs de género (separados por coma)
        minRating,     // Filtrar por puntuación mínima
        startYear,     // Filtrar por año de lanzamiento (inicio)
        endYear,       // Filtrar por año de lanzamiento (fin)
        sortBy = 'release_date', // Campo para ordenar (por defecto: release_date)
        order = 'desc', // Orden (asc/desc, por defecto: desc)
    } = req.query;

    const query: any = {};

    // 1. Filtro por búsqueda (title)
    if (search && typeof search === 'string') {
        query.title = { $regex: search, $options: 'i' }; // Búsqueda insensible a mayúsculas/minúsculas
    }

    // 2. Filtro por géneros (genres)
    // Asume que tienes un array de IDs de género de TMDB
    // Si TMDB da '28' para Acción, y tienes [28, 12, 16] en tu Movie.genres
    if (genreId && typeof genreId === 'string') {
        const genreIdsArray = genreId.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        if (genreIdsArray.length > 0) {
            // $in para OR de varios géneros, $all para AND
            query.genres = { $in: genreIdsArray };
        }
    }

    // 3. Filtro por puntuación mínima (vote_average)
    if (minRating && typeof minRating === 'string') {
        const minRatingNum = parseFloat(minRating);
        if (!isNaN(minRatingNum)) {
            query.vote_average = { $gte: minRatingNum };
        }
    }

    // 4. Filtro por rango de años de lanzamiento (release_date)
    const dateQuery: any = {};
    if (startYear && typeof startYear === 'string') {
        const start = new Date(parseInt(startYear), 0, 1); // Enero 1 del año de inicio
        dateQuery.$gte = start;
    }
    if (endYear && typeof endYear === 'string') {
        const end = new Date(parseInt(endYear), 11, 31, 23, 59, 59); // Diciembre 31 del año de fin
        dateQuery.$lte = end;
    }
    if (Object.keys(dateQuery).length > 0) {
        query.release_date = dateQuery;
    }

    // 5. Ordenamiento (Sorting)
    const sortOptions: { [key: string]: SortOrder } = {}; // Tipado para Mongoose SortOrder
    const validSortFields = ['release_date', 'vote_average', 'title']; // Campos permitidos para ordenar

    if (validSortFields.includes(sortBy as string)) {
        sortOptions[sortBy as string] = order === 'asc' ? 1 : -1; // 1 para ASC, -1 para DESC
    } else {
        // Por defecto, si el campo no es válido, ordena por release_date descendente
        sortOptions.release_date = -1;
    }

    try {
        const movies = await Movie.find(query)
                                  .sort(sortOptions)
                                  .exec(); // Usar .exec() para Promesas

        res.status(200).json(movies);
    } catch (error: any) {
        console.error('Error al obtener películas:', error.message);
        res.status(500).json({ message: 'Error al obtener películas.', error: error.message });
    }
}));

export default router;