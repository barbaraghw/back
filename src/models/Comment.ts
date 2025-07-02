// src/models/Comment.ts
import mongoose, { Schema, Document, Types } from 'mongoose'; // Ensure 'Types' is imported if used directly like Types.ObjectId

import { IUser } from './User'; // Import IUser for type checking
import { IMovie } from './Movie'; // Import IMovie for type checking (optional, but good practice)

export interface IComment extends Document {
    user: Types.ObjectId | IUser; // Reference to the User who made the comment
    movie: Types.ObjectId | IMovie; // Reference to the Movie the comment is for
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
    movie: { // This MUST be 'movie', NOT 'movieId'
        type: Schema.Types.ObjectId,
        ref: 'Movie', // Refers to the 'Movie' model
        required: true,
    },
    text: {
        type: String,
        required: true,
        maxlength: [500, 'El comentario no puede exceder los 500 caracteres.'],
    },
    rating: { // This MUST be 'rating'
        type: Number,
        required: true,
        min: [0.5, 'La puntuación debe ser al menos 1.'],
        max: [5, 'La puntuación no puede exceder 5.'],
    },
}, {
    timestamps: true, // Adds createdAt and updatedAt timestamps automatically
});

// Add an index to improve query performance when finding comments for a specific movie or user
CommentSchema.index({ movie: 1, user: 1 });

export default mongoose.model<IComment>('Comment', CommentSchema);