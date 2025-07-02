// src/controllers/commentController.ts
import { Request, Response, NextFunction } from 'express';
import Comment, { IComment } from '../models/Comment';
import AppError from '../utils/AppError';
import { IUser } from '../models/User';
import { IAuthenticatedUser } from '../types/authenticatedUser';

const getCurrentUser = (req: Request): IAuthenticatedUser => {
    const user = req.user as IAuthenticatedUser | undefined;
    if (!user) {
        throw new AppError('Usuario no autenticado.', 401);
    }
    return user;
};

// -- Rutas de LECTURA (GET) --

// @desc    Get average rating and number of ratings for a specific movie
// @route   GET /api/comments/ratings/:movieId
// @access  Public (Anyone can see movie ratings)
export const getRatingsForMovie = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { movieId } = req.params;

        if (!movieId) {
            return next(new AppError('Se requiere el ID de la película para obtener los ratings.', 400));
        }

        // Usar agregación para calcular el promedio y el conteo
        const result = await Comment.aggregate([
            {
                $match: { movie: movieId }
            },
            {
                $group: {
                    _id: null, // Agrupa todos los documentos que coincidan
                    averageRating: { $avg: '$rating' }, // Calcula el promedio del campo 'rating'
                    numberOfRatings: { $sum: 1 } // Cuenta el número de documentos (ratings)
                }
            }
        ]);

        if (result.length === 0) {
            // Si no hay comentarios para la película, devuelve valores predeterminados
            return res.status(200).json({ averageRating: 0, numberOfRatings: 0 });
        }

        // Devuelve el resultado del pipeline de agregación
        res.status(200).json({
            averageRating: parseFloat(result[0].averageRating.toFixed(1)), // Redondea a un decimal
            numberOfRatings: result[0].numberOfRatings
        });

    } catch (error) {
        console.error('Error al obtener el promedio de ratings de comentarios por ID de película:', error);
        next(new AppError('Error del servidor al obtener el promedio de ratings de comentarios.', 500));
    }
};


// @desc    Get all comments for a specific movie (used for the full comments list)
// @route   GET /api/comments/list/:movieId
// @access  Public (Anyone can see comments)
export const getCommentsForMovie = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { movieId } = req.params;

        if (!movieId) {
            return next(new AppError('Se requiere el ID de la película para obtener los comentarios.', 400));
        }

        const comments = await Comment.find({ movie: movieId })
            .populate('user', 'username _id')
            .sort({ createdAt: 1 });
            console.log(`[Backend] Found ${comments.length} comments.`);
            console.log('[BACKEND DEBUG] Comments fetched with ratings:', comments.map(c => c.rating)); // ADD THIS LINE
      
        res.status(200).json({ success: true, data: { comments: comments } });

        const commentsWithFlags = await Promise.all(comments.map(async (comment) => {
            const userIdFromComment = (comment.user as any)._id;

            const earlierCommentsCount = await Comment.countDocuments({
                user: userIdFromComment,
                movie: movieId,
                createdAt: { $lt: comment.createdAt }
            });

            const isSubsequentComment = earlierCommentsCount > 0;

            return {
                ...comment.toObject({ getters: true, virtuals: true }),
                isSubsequentComment: isSubsequentComment,
            };
        }));

        res.status(200).json({
            status: 'success',
            results: commentsWithFlags.length,
            data: {
                comments: commentsWithFlags,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get a single comment by ID
// @route   GET /api/comments/single/:id
// @access  Public (Anyone can see a specific comment)
export const getCommentById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const comment = await Comment.findById(id).populate('user', 'username _id');

        if (!comment) {
            return next(new AppError('Comentario no encontrado.', 404));
        }

        const commentUser = comment.user as IUser;
        const earlierCommentsCount = await Comment.countDocuments({
            user: commentUser._id,
            movie: comment.movie,
            createdAt: { $lt: comment.createdAt }
        });

        const isSubsequentComment = earlierCommentsCount > 0;

        res.status(200).json({
            status: 'success',
            data: {
                comment: {
                    ...comment.toObject({ getters: true, virtuals: true }),
                    isSubsequentComment: isSubsequentComment,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};


// -- Rutas de ESCRITURA (POST/PUT/DELETE) --
// @desc    Create a new comment
// @route   POST /api/comments
// @access  Private (Auth required)
export const createComment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { movieId, text, rating } = req.body;
        const user = getCurrentUser(req);

        if (!movieId || !text || rating === undefined) {
            return next(new AppError('Por favor, proporciona el ID de la película, el texto y la puntuación.', 400));
        }

        if (typeof rating !== 'number' || rating < 0.5 || rating > 5) {
            return next(new AppError('La puntuación debe ser un número entre 1 y 10.', 400));
        }

        const newComment: IComment = await Comment.create({
            user: user._id,
            movie: movieId,
            text,
            rating,
        });

        await newComment.populate('user', 'email _id');

        res.status(201).json({
            status: 'success',
            data: {
                comment: newComment,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update a comment (only by its creator)
// @route   PUT /api/comments/:id
// @access  Private (Auth required + Owner check)
export const updateComment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { text, rating } = req.body;
        const user = getCurrentUser(req);

        if (!text && rating === undefined) {
            return next(new AppError('Por favor, proporciona el texto o la puntuación para actualizar.', 400));
        }
        if (rating !== undefined && (typeof rating !== 'number' || rating < 0.5 || rating > 5)) {
            return next(new AppError('La puntuación debe ser un número entre 1 y 10.', 400));
        }

        const comment = await Comment.findById(id);

        if (!comment) {
            return next(new AppError('Comentario no encontrado.', 404));
        }

        if (comment.user.toString() !== user._id.toString()) {
            return next(new AppError('No tienes permiso para editar este comentario.', 403));
        }

        comment.text = text || comment.text;
        comment.rating = rating !== undefined ? rating : comment.rating;

        await comment.save();

        await comment.populate('user', 'email _id');

        res.status(200).json({
            status: 'success',
            message: 'Comentario actualizado exitosamente.',
            data: {
                comment,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a comment (only by its creator)
// @route   DELETE /api/comments/:id
// @access  Private (Auth required + Owner check)
export const deleteComment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const user = getCurrentUser(req);

        const comment = await Comment.findById(id);

        if (!comment) {
            return next(new AppError('Comentario no encontrado.', 404));
        }

        if (comment.user.toString() !== user._id.toString()) {
            return next(new AppError('No tienes permiso para eliminar este comentario.', 403));
        }

        await Comment.deleteOne({ _id: id });

        res.status(204).json({
            status: 'success',
            message: 'Comentario eliminado exitosamente.',
            data: null,
        });
    } catch (error) {
        next(error);
    }
};