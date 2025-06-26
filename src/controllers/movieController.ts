// src/controllers/movieController.ts (Crea este archivo si no lo tienes, o añade a uno existente)
import { Request, Response, NextFunction } from 'express';
import Movie, { IMovie } from '../models/Movie'; // Asegúrate de que la ruta a tu modelo Movie sea correcta
import mongoose from 'mongoose'; // Necesario para mongoose.Types.ObjectId


export const getMovieById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const movieId = req.params.id; // Obtiene el ID de los parámetros de la URL

        // Opcional pero recomendado: Validar que el ID sea un ObjectId válido de MongoDB
        if (!mongoose.Types.ObjectId.isValid(movieId)) {
            return res.status(400).json({ message: 'Formato de ID de película inválido.' });
        }

        const movie = await Movie.findById(movieId); // Busca la película por su ID

        if (!movie) {
            return res.status(404).json({ message: 'Película no encontrada.' });
        }

        res.status(200).json(movie); // Envía la película encontrada
    } catch (error) {
        console.error('Error al obtener los detalles de la película:', error);
        // Puedes refinar el manejo de errores aquí si es necesario
        next(error); // Pasa el error al middleware de manejo de errores de Express
    }
};