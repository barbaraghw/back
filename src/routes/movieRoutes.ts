// src/routes/movieRoutes.ts
import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import Movie, { IMovie } from '../models/Movie';
import Comment from '../models/Comment';
import { SortOrder } from 'mongoose';
import passport from 'passport';
import mongoose from 'mongoose';
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
        minRating, // Rating mínimo o el inicio de la "decena"
        maxRating, // Rating máximo explícito
        startYear,
        endYear,
        sortBy = 'release_date',
        order = 'desc',
        type,
        page = '1',
        pageSize = '20'
    } = req.query;

    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const skip = (pageNum - 1) * pageSizeNum;

    const initialMatchQuery: any = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let movies: IMovie[] = [];

    const isSectionType = ['latest', 'popular', 'upcoming'].includes(type as string);
    const effectiveLimit = isSectionType ? pageSizeNum : 0;

    let aggregationPipeline: any[] = [];

    // --- Build initial match filters (before any lookups/unwinds that might filter out documents) ---
    if (search && typeof search === 'string') {
        initialMatchQuery.title = { $regex: search, $options: 'i' };
    }

    if (genreId && typeof genreId === 'string') {
        const genreIdsArray = genreId.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        if (genreIdsArray.length > 0) {
            initialMatchQuery['genres.id'] = { $in: genreIdsArray };
        }
    }

    const dateQuery: any = {};
    if (startYear && typeof startYear === 'string') {
        const start = new Date(parseInt(startYear), 0, 1);
        dateQuery.$gte = start;
    }
    if (endYear && typeof endYear === 'string') {
        const end = new Date(parseInt(endYear), 11, 31, 23, 59, 59);
        dateQuery.$lte = end;
    }

    if (type === 'latest') {
        dateQuery.$lte = today;
    } else if (type === 'upcoming') {
        dateQuery.$gte = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    }

    if (Object.keys(dateQuery).length > 0) {
        initialMatchQuery.release_date = dateQuery;
    }

    if (Object.keys(initialMatchQuery).length > 0) {
        aggregationPipeline.push({ $match: initialMatchQuery });
    }

    // --- Logic for 'popular' type ---
    if (type === 'popular') {
        aggregationPipeline.push(
            {
                $lookup: {
                    from: 'comments',
                    localField: '_id',
                    foreignField: 'movie',
                    as: 'commentsData'
                }
            },
            {
                $addFields: {
                    commentCount: { $size: '$commentsData' }
                }
            },
            { $sort: { commentCount: -1, vote_average: -1, release_date: -1 } },
            ...(effectiveLimit > 0 ? [{ $limit: effectiveLimit }] : []),
            {
                $project: {
                    _id: 1, title: 1, overview: 1, release_date: 1, vote_average: 1,
                    poster_path: 1, backdrop_path: 1, genres: 1, runtime: 1, tmdbId: 1,
                    commentCount: 1,
                }
            },
        );

        movies = await Movie.aggregate(aggregationPipeline) as IMovie[];

        if (movies.length < effectiveLimit && movies.length < 5) {
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
        // --- Average Comment Rating Calculation and Filtering for general queries ---
        // This block runs if not 'popular' AND if minRating/maxRating/sortBy is related to comments.
        if (minRating || maxRating || (sortBy === 'averageCommentRating')) {
            const minRatingNum = parseFloat(minRating as string);
            let effectiveMaxRatingNum = parseFloat(maxRating as string); // Usamos 'let' para poder modificarlo

            // Si solo se proporciona minRating, define el rango de la "decena"
            if (!isNaN(minRatingNum) && isNaN(effectiveMaxRatingNum)) {
                effectiveMaxRatingNum = minRatingNum + 0.9999; // Para incluir ratings hasta, por ejemplo, 3.9999
            }

            aggregationPipeline.push(
                {
                    $lookup: {
                        from: 'comments',
                        localField: '_id',
                        foreignField: 'movie',
                        as: 'movieComments'
                    }
                },
                // Crucial para MongoDB < 2.6: $unwind sin preserveNullAndEmptyArrays
                // Esto elimina las películas sin comentarios del pipeline.
                // Si una película NO tiene comentarios, NO aparecerá si se usa un filtro de rating.
                { $unwind: '$movieComments' },
                {
                    $group: {
                        _id: '$_id', // Group by movie ID
                        title: { $first: '$title' },
                        tmdbId: { $first: '$tmdbId' },
                        overview: { $first: '$overview' },
                        release_date: { $first: '$release_date' },
                        vote_average: { $first: '$vote_average' },
                        poster_path: { $first: '$poster_path' },
                        backdrop_path: { $first: '$backdrop_path' },
                        genres: { $first: '$genres' },
                        runtime: { $first: '$runtime' },
                        // Calculate average rating
                        averageCommentRating: { $avg: '$movieComments.rating' }
                    }
                }
            );

            // Apply the match filters on the newly computed averageCommentRating
            const ratingMatchCriteria: any = {};

            if (!isNaN(minRatingNum)) {
                // Si solo se busca por un "minRating" que representa la decena (ej. 3.0-3.9)
                if (isNaN(parseFloat(maxRating as string))) { // Si maxRating NO está definido explícitamente
                    ratingMatchCriteria.averageCommentRating = {
                        $gte: minRatingNum,
                        $lte: effectiveMaxRatingNum // Usamos el effectiveMaxRatingNum calculado
                    };
                } else { // Si minRating Y maxRating están definidos explícitamente
                    ratingMatchCriteria.averageCommentRating = { $gte: minRatingNum };
                }
            }

            if (!isNaN(parseFloat(maxRating as string))) { // Si maxRating está definido explícitamente
                if (ratingMatchCriteria.averageCommentRating) {
                    ratingMatchCriteria.averageCommentRating.$lte = effectiveMaxRatingNum;
                } else {
                    ratingMatchCriteria.averageCommentRating = { $lte: effectiveMaxRatingNum };
                }
            }

            if (Object.keys(ratingMatchCriteria).length > 0) {
                aggregationPipeline.push({ $match: ratingMatchCriteria });
            }
        }

        // --- Final Ordering ---
        const sortOptions: { [key: string]: SortOrder } = {};
        const validSortFields = ['release_date', 'vote_average', 'title', 'averageCommentRating'];

        if (sortBy && typeof sortBy === 'string' && validSortFields.includes(sortBy)) {
            // Para `averageCommentRating`, ya sabemos que solo las películas con comentarios llegan a este punto
            // gracias al `$unwind`, por lo que el valor será numérico.
            sortOptions[sortBy] = order === 'asc' ? 1 : -1;
        } else {
            sortOptions.release_date = -1; // Default sort
        }

        if (Object.keys(sortOptions).length > 0) {
            aggregationPipeline.push({ $sort: sortOptions });
        }


        // --- Pagination ---
        if (!isSectionType) {
            aggregationPipeline.push(
                { $skip: skip },
                { $limit: pageSizeNum }
            );
        }

        // --- Final Projection to ensure output format ---
        // This MUST be an inclusion-only projection to avoid the "Cannot do exclusion..." error.
        // We only list the fields we want to appear.
        aggregationPipeline.push({
            $project: {
                _id: '$_id', // From the $group stage
                title: '$title',
                tmdbId: '$tmdbId',
                overview: '$overview',
                release_date: '$release_date',
                vote_average: '$vote_average', // Mantén si lo necesitas, es el de TMDB
                poster_path: '$poster_path',
                backdrop_path: '$backdrop_path',
                genres: '$genres',
                runtime: '$runtime',
                averageCommentRating: '$averageCommentRating' // El promedio calculado
            }
        });

        movies = await Movie.aggregate(aggregationPipeline) as IMovie[];
    }

    res.status(200).json(movies);
}));

export default router;