// src/models/Movie.ts
import { Document, Schema, model } from 'mongoose'; // Import Schema and model

// 1. Define the interface for a new movie document (what you provide)
export interface IMovieInput {
  title: string;
  tmdbId: string;
  overview: string;
  release_date: Date;
  vote_average: number;
  poster_path: string;
  backdrop_path?: string; // Optional if not always present
  genres: number[];
  // Add any other properties you specifically set when creating a new movie
}

// 2. Define the interface for a movie document *retrieved from MongoDB*
// This extends Document and includes all the fields from IMovieInput
export interface IMovie extends IMovieInput, Document {
  // Mongoose automatically adds _id, __v, and other methods/properties
  // You can add more specific Mongoose properties if you need to override/add to Document:
  // _id: Types.ObjectId; // Explicitly if you need to refer to ObjectId
  // createdAt: Date; // If using timestamps
  // updatedAt: Date; // If using timestamps
}

// 3. Define your Mongoose Schema
const MovieSchema = new Schema<IMovie>({ // Use IMovie here
  title: { type: String, required: true },
  tmdbId: { type: String, required: true, unique: true }, // Ensure tmdbId is unique
  overview: { type: String, default: '' },
  release_date: { type: Date, default: Date.now },
  vote_average: { type: Number, default: 0 },
  poster_path: { type: String, default: '' },
  backdrop_path: { type: String }, // Optional field, so no 'required: true'
  genres: { type: [Number], default: [] }, // Array of numbers
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
});


// Export the Mongoose Model
const Movie = model<IMovie>('Movie', MovieSchema);

export default Movie;