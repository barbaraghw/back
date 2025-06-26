// src/models/Comment.ts
import mongoose, { Schema, Document } from 'mongoose';

// Assuming you have an IMovie interface, if not, adjust as needed.
// For simplicity, we'll just refer to it by its ObjectId.
// If you have a separate Series model, you might make 'movie' an optional 'content' field
// and add a 'contentType' field (e.g., 'Movie', 'Series'). For now, let's assume 'movie'.

import { IUser } from './User'; // Import IUser for type checking
import { IMovie } from './Movie'; // Import IMovie for type checking (optional, but good practice)

export interface IComment extends Document {
    user: mongoose.Types.ObjectId | IUser; // Reference to the User who made the comment
    movie: mongoose.Types.ObjectId | IMovie; // Reference to the Movie the comment is for
    text: string;
    rating: number; // Score/rating given by the user for the movie/series (e.g., 1-10)
    createdAt: Date;
    updatedAt: Date;
}

const CommentSchema: Schema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User', // Refers to the 'User' model
        required: true,
    },
    movie: {
        type: Schema.Types.ObjectId,
        ref: 'Movie', // Refers to the 'Movie' model
        required: true,
    },
    text: {
        type: String,
        required: true,
        maxlength: [500, 'El comentario no puede exceder los 500 caracteres.'],
    },
    rating: {
        type: Number,
        required: true,
        min: [1, 'La puntuación debe ser al menos 1.'],
        max: [10, 'La puntuación no puede exceder 10.'],
    },
}, {
    timestamps: true, // Adds createdAt and updatedAt timestamps automatically
});

// Add an index to improve query performance when finding comments for a specific movie or user
CommentSchema.index({ movie: 1, user: 1 });

export default mongoose.model<IComment>('Comment', CommentSchema);