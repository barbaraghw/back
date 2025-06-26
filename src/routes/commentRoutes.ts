// src/routes/commentRoutes.ts
import { Router } from 'express';
import { authenticateJWT } from '../middleware/authMiddleware'; // Make sure this path is correct
import {
    createComment,
    getCommentsForMovie,
    updateComment,
    deleteComment,
    getCommentById,
} from '../controllers/commentController'; // Make sure this path is correct

const router: Router = Router();

// Routes for comments
// Public routes (anyone can read comments)
router.get('/:movieId', getCommentsForMovie); // Get all comments for a specific movie
router.get('/single/:id', getCommentById); // Get a single comment by ID

// Private routes (authentication required)
// User must be authenticated to create, update, or delete comments
router.post('/', authenticateJWT, createComment);
router.put('/:id', authenticateJWT, updateComment);
router.delete('/:id', authenticateJWT, deleteComment);


export default router;