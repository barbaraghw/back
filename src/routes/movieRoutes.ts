// src/routes/movieRoutes.ts
import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import Movie, { IMovie } from '../models/Movie';
import Comment from '../models/Comment';
import { SortOrder } from 'mongoose';
import passport from 'passport';
import mongoose from 'mongoose'; // Necesario para mongoose.Types.ObjectId
import { getMovieById } from '../controllers/movieController';
const router: Router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
    (req: Request, res: Response, next: NextFunction) =>
        Promise.resolve(fn(req, res, next)).catch(next);

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

router.get('/:id', authenticateJWT, asyncHandler(getMovieById)); 

router.get('/', authenticateJWT, asyncHandler(async (req: Request, res: Response) => {
    const {
        search,
        genreId,
        minRating,
        startYear,
        endYear,
        sortBy = 'release_date',
        order = 'desc',
        type, // e.g., 'latest', 'popular', 'upcoming', 'category', 'genre', 'all'
        page = '1', // Nuevo: Parámetro para la paginación, por defecto página 1
        pageSize = '20' // Nuevo: Parámetro para el tamaño de página, por defecto 20 elementos
    } = req.query;

    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const skip = (pageNum - 1) * pageSizeNum;

    const query: any = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Inicio del día de hoy

    let movies: IMovie[] = [];
    
    // Determina si es un tipo de "sección" específica (latest, popular, upcoming)
    // que generalmente se muestran con un límite fijo en la pantalla principal,
    // o si es una consulta de lista completa (como 'all', búsqueda o filtro sin 'type' de sección).
    const isSectionType = ['latest', 'popular', 'upcoming'].includes(type as string);
    // effectiveLimit será el límite para las secciones, 0 si no se aplica un límite fijo
    // (en cuyo caso se usará skip/pageSize para paginación).
    const effectiveLimit = isSectionType ? pageSizeNum : 0; 

    if (type === 'popular') {
        const popularMovies = await Movie.aggregate([
            {
                $lookup: {
                    from: 'comments', // Nombre de tu colección de comentarios en MongoDB
                    localField: '_id',
                    foreignField: 'movie', // Asegúrate de que esto coincide con el campo en tu modelo Comment
                    as: 'commentsData'
                }
            },
            {
                $addFields: {
                    commentCount: { $size: '$commentsData' }
                }
            },
            { $sort: { commentCount: -1, vote_average: -1, release_date: -1 } },
            // Aplica límite si es un tipo de sección
            ...(effectiveLimit > 0 ? [{ $limit: effectiveLimit }] : []),
            {
                $project: {
                    _id: 1, // Incluye todos los campos que necesitas para IMovie
                    title: 1,
                    overview: 1,
                    release_date: 1,
                    vote_average: 1,
                    poster_path: 1,
                    backdrop_path: 1,
                    genres: 1,
                    runtime: 1,
                    tmdbId: 1,
                }
            },
        ]);

        movies = popularMovies as IMovie[];

        // Fallback para populares si hay pocos comentarios.
        // Este fallback también debe respetar el 'effectiveLimit'.
        if (movies.length < effectiveLimit && movies.length < 5) { // Si obtuvimos menos de lo solicitado o muy pocas.
            console.log('No se encontraron suficientes películas con comentarios. Volviendo a películas aleatorias/recientes.');
            const numToFetch = effectiveLimit - movies.length;
            const fallbackMovies = await Movie.find({})
                .sort({ release_date: -1, vote_average: -1 })
                .limit(numToFetch)
                .skip(Math.floor(Math.random() * Math.max(0, (await Movie.countDocuments()) - numToFetch)));
            
            const existingMovieIds = new Set(movies.map(m => (m._id as mongoose.Types.ObjectId).toString()));
            const uniqueFallbackMovies = fallbackMovies.filter(fm => !existingMovieIds.has((fm._id as mongoose.Types.ObjectId).toString()));
            
            movies = [...movies, ...uniqueFallbackMovies].slice(0, effectiveLimit);
        }

    } else {
        // Lógica existente para otros filtros (búsqueda, género, rangos de fechas, etc.)
        if (search && typeof search === 'string') {
            query.title = { $regex: search, $options: 'i' };
        }

         if (genreId && typeof genreId === 'string') {
            const genreIdsArray = genreId.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            if (genreIdsArray.length > 0) {
                // CAMBIADO de `query.genres` a `query['genres.id']`
                query['genres.id'] = { $in: genreIdsArray }; 
            }
        }

        if (minRating && typeof minRating === 'string') {
            const minRatingNum = parseFloat(minRating);
            if (!isNaN(minRatingNum)) {
                query.vote_average = { $gte: minRatingNum };
            }
        }

        const dateQuery: any = query.release_date || {};

        if (startYear && typeof startYear === 'string') {
            const start = new Date(parseInt(startYear), 0, 1);
            dateQuery.$gte = start;
        }
        if (endYear && typeof endYear === 'string') {
            const end = new Date(parseInt(endYear), 11, 31, 23, 59, 59);
            dateQuery.$lte = end;
        }

        if (type === 'latest') {
            dateQuery.$lte = today; // Películas estrenadas hasta hoy
            // El `effectiveLimit` manejará el límite para esta sección.
        } else if (type === 'upcoming') {
            dateQuery.$gte = new Date(today.getTime() + 24 * 60 * 60 * 1000); // Películas estrenadas después de hoy
            // El `effectiveLimit` manejará el límite para esta sección.
        }

        if (Object.keys(dateQuery).length > 0) {
            query.release_date = dateQuery;
        }

        const sortOptions: { [key: string]: SortOrder } = {};
        const validSortFields = ['release_date', 'vote_average', 'title'];

        if (validSortFields.includes(sortBy as string)) {
            sortOptions[sortBy as string] = order === 'asc' ? 1 : -1;
        } else {
            sortOptions.release_date = -1; // Ordenamiento por defecto para consultas generales
        }

        let queryChain = Movie.find(query).sort(sortOptions);

        if (!isSectionType) { // Aplica paginación para consultas que no son de sección (como listas "Ver todo")
            queryChain = queryChain.skip(skip).limit(pageSizeNum);
        } else if (effectiveLimit > 0) { // Aplica un límite fijo para consultas de sección
            queryChain = queryChain.limit(effectiveLimit);
        }

        movies = await queryChain.exec();
    }

    res.status(200).json(movies);
}));

export default router;