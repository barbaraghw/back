// src/controllers/commentController.ts
import { Request, Response, NextFunction } from 'express';
import Comment, { IComment } from '../models/Comment';
import AppError from '../utils/AppError';
import { IUser } from '../models/User';
import { IAuthenticatedUser } from '../types/authenticatedUser';

const getCurrentUser = (req: Request): IAuthenticatedUser => { // <--- CHANGE RETURN TYPE
    // req.user is now correctly typed as IAuthenticatedUser | undefined due to express.d.ts
    const user = req.user as IAuthenticatedUser | undefined; 
    if (!user) {
        throw new AppError('Usuario no autenticado.', 401);
    }
    return user;
};


// @desc    Create a new comment
// @route   POST /api/comments
// @access  Private (Auth required)
export const createComment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { movieId, text, rating } = req.body;
        const user = getCurrentUser(req);

        // Basic validation
        if (!movieId || !text || rating === undefined) {
            return next(new AppError('Por favor, proporciona el ID de la película, el texto y la puntuación.', 400));
        }

        if (typeof rating !== 'number' || rating < 1 || rating > 10) {
            return next(new AppError('La puntuación debe ser un número entre 1 y 10.', 400));
        }

        // --- REMOVE THE DUPLICATE COMMENT CHECK ---
        // Since you want to allow multiple comments from the same user
        // The previous check:
        // const existingComment = await Comment.findOne({ user: user._id, movie: movieId });
        // if (existingComment) {
        //     return next(new AppError('Ya has comentado y puntuado esta película. Puedes editar tu comentario existente.', 409));
        // }
        // Is now removed.
        // --- END REMOVAL ---

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

// @desc    Get all comments for a specific movie
// @route   GET /api/comments/:movieId
// @access  Public (Anyone can see comments)
export const getCommentsForMovie = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { movieId } = req.params;

        if (!movieId) {
            return next(new AppError('Se requiere el ID de la película para obtener los comentarios.', 400));
        }

        // Fetch comments and populate user data
         const comments = await Comment.find({ movie: movieId })
            .populate('user', 'username _id')
            .sort({ createdAt: 1 }); // Sort by creation time to easily identify 'first' comments

        // Now, process comments to add a 'isSubsequentComment' flag
        const commentsWithFlags = await Promise.all(comments.map(async (comment) => {
            // Ensure user property is populated and is an object, not just an ID
            const userIdFromComment = (comment.user as any)._id; 

            // Count how many comments this user has made on this movie *before* this specific comment
            const earlierCommentsCount = await Comment.countDocuments({
                user: userIdFromComment, 
                movie: movieId,
                createdAt: { $lt: comment.createdAt } // Comments created strictly before this one
            });

            // If there are any comments by this user on this movie that were created earlier,
            // then this comment is a subsequent one.
            const isSubsequentComment = earlierCommentsCount > 0;

            // Return the comment data along with the new flag
            return {
                ...comment.toObject({ getters: true, virtuals: true }), // Convert Mongoose doc to plain object
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
        if (rating !== undefined && (typeof rating !== 'number' || rating < 1 || rating > 10)) {
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

        // Re-populate to ensure response consistency if needed
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

        // To determine if this specific comment is a subsequent one by the same user
        const commentUser = comment.user as IUser;
        const earlierCommentsCount = await Comment.countDocuments({
            user: commentUser._id,
            movie: comment.movie, // Use comment.movie here directly
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