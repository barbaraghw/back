// src/routes/movieImportRoutes.ts
import { Router, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import AppError from '../utils/AppError';
import { authenticateJWT } from '../middleware/authMiddleware';
import {
    importPopularMovies, // Ya la estás importando
    TMDBMovie,         // <--- IMPORTAR TMDBMovie
    formatTmdbMovie    // <--- IMPORTAR formatTmdbMovie
} from '../utils/movieImporter'; // Asegúrate de que movieImporter.ts las exporte
import axios, { AxiosError } from 'axios'; // <--- IMPORTAR AxiosError
import { z } from 'zod';
import Movie, { IMovieInput } from '../models/Movie'; // IMovieInput si la necesitas directamente
import User, {IUser} from '../models/User';

dotenv.config();

const router: Router = Router();
const movieSearchSchema = z.object({
    search: z.string().trim().optional().default(''),
});

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
// IMAGE_BASE_URL no es necesario aquí si formatTmdbMovie lo maneja internamente
// y si no la usas para nada más en este archivo.
// const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) =>
        Promise.resolve(fn(req, res, next)).catch(next);

const checkTmdbApiKey = (req: Request, res: Response, next: NextFunction) => {
    if (!TMDB_API_KEY) {
        res.status(500).json({ message: 'Error de configuración del servidor: La clave API de TMDB no está definida.' });
        return;
    }
    next();
};


router.get('/import-popular', authenticateJWT, checkTmdbApiKey, asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Explicitly assert req.user as IUser | undefined directly.
    // This overrides any conflicting inference.
    const user = req.user as IUser | undefined; // <-- Apply the assertion here

    const userEmail = user ? user.email : 'N/A';
    console.log(`User ${userEmail} is manually triggering import of popular movies.`);

    try {
        const importedCount = await importPopularMovies(10);
        res.status(200).json({
            message: 'Importación de películas populares de TMDB completada.',
            importedCount: importedCount
        });
    } catch (error) {
        next(error);
    }
}));

router.get('/search-and-import', authenticateJWT, checkTmdbApiKey, asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const parsedQuery = movieSearchSchema.parse(req.query);
    const query = parsedQuery.search;

    const currentUser = req.user;
    if (!currentUser) {
        return next(new AppError('Usuario no autenticado para realizar esta operación.', 401));
    }

    // Aserción de tipo explícita: Decimos a TypeScript "confía en mí, esto es un IUser"
    const userToLog = currentUser as IUser; // <--- AGREGAR ESTA LÍNEA

    console.log(`User ${userToLog.email} (ID: ${userToLog._id}) is attempting to search and import movies for query: "${query}"`);
    // Ahora, userToLog.email y userToLog._id no deberían dar error.
    if (!query) {
        throw new AppError('Se requiere un parámetro de consulta (query) para buscar películas.', 400);
    }
    try {
        const tmdbResponse = await axios.get(`${TMDB_BASE_URL}/search/movie`, {
            params: {
                api_key: TMDB_API_KEY,
                language: 'es-ES',
                query: query,
            },
        });

        if (!tmdbResponse.data || !Array.isArray(tmdbResponse.data.results)) {
            console.error('TMDB response for search is not in expected format:', tmdbResponse.data);
            throw new AppError('Error al procesar la respuesta de TMDB para la búsqueda.', 500);
        }

        const tmdbMovies: TMDBMovie[] = tmdbResponse.data.results; // TMDBMovie ya importado
        const moviesToInsert: IMovieInput[] = [];

        for (const tmdbMovie of tmdbMovies) {
            const formattedMovie = formatTmdbMovie(tmdbMovie); // formatTmdbMovie ya importado
            if (formattedMovie) {
                const existingMovie = await Movie.findOne({ tmdbId: formattedMovie.tmdbId });
                if (!existingMovie) {
                    moviesToInsert.push(formattedMovie);
                }
            }
        }

        let insertedCount = 0;
        if (moviesToInsert.length > 0) {
            try {
                const insertedDocs = await Movie.insertMany(moviesToInsert as any[], { ordered: false });
                insertedCount = insertedDocs.length;
                console.log(`Se insertaron ${insertedCount} películas nuevas por búsqueda.`);
            } catch (mongoError: any) {
                if (mongoError.code === 11000) {
                    console.warn('Advertencia de inserción: Algunas películas ya existían y no se insertaron (duplicado).');
                    insertedCount = moviesToInsert.length - (mongoError.writeErrors ? mongoError.writeErrors.length : 0);
                } else {
                    console.error('Error al insertar películas por búsqueda en la base de datos:', mongoError);
                    throw new AppError('Error interno del servidor al guardar películas por búsqueda.', 500);
                }
            }
        } else {
            console.log(`No se encontraron películas nuevas para importar por búsqueda "${query}" o ya existen todas.`);
        }

        res.status(200).json({ message: `Importación de películas para la consulta "${query}" completada.`, importedCount: insertedCount });

    } catch (error: any) {
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError; // AxiosError ya importado
            console.error('Error de Axios al importar películas por búsqueda:', axiosError.message);
            if (axiosError.response) {
                console.error('TMDB Response Status:', axiosError.response.status);
                console.error('TMDB Response Data:', axiosError.response.data);
                if (axiosError.response.status === 401 || axiosError.response.status === 403) {
                    throw new AppError('Error de autenticación con TMDB al buscar. Verifica tu clave API.', 401);
                }
            } else if (axiosError.request) {
                throw new AppError('No se pudo conectar con el servidor de TMDB al buscar. Verifica tu conexión.', 504);
            } else {
                throw new AppError('Error al preparar la solicitud de búsqueda a TMDB.', 500);
            }
        } else if (error instanceof z.ZodError) {
            console.error('Error de validación de consulta de búsqueda:', error.errors);
            throw new AppError('Parámetros de búsqueda inválidos.', 400);
        }
        console.error('Error inesperado al importar películas por búsqueda:', error);
        throw new AppError('Error interno del servidor.', 500);
    }
}));


export default router;