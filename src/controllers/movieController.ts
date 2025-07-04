// src/controllers/movieController.ts (Crea este archivo si no lo tienes, o añade a uno existente)
import { Request, Response, NextFunction } from 'express';
import Movie, { IMovie } from '../models/Movie'; // Asegúrate de que la ruta a tu modelo Movie sea correcta
import mongoose from 'mongoose'; // Necesario para mongoose.Types.ObjectId

interface MovieQueryParams {
  genre?: string | string[]; // Can be a single string (e.g., "28") or a comma-separated string ("28,12") or an array of strings (e.g., ["28", "12"])
  sortBy?: string;
  order?: 'asc' | 'desc';
  searchText?: string;
}

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

// In your backend controller (e.g., controllers/movieController.js)
export const getFilteredMovies = async (req: Request<{}, {}, {}, MovieQueryParams>, res: Response) => {
  try {
    // Desestructuramos los parámetros de la consulta con tipado seguro
    const { genre, sortBy, order, searchText } = req.query;

    // `query` es un objeto que construiremos para la consulta de Mongoose
    // Usamos `Record<string, any>` para permitir propiedades dinámicas
    let query: Record<string, any> = {};

    // --- Manejo del filtro por Género ---
    if (genre) {
      let genreIds: number[] = [];

      // Si 'genre' es un string (ej. "28" o "28,12")
      if (typeof genre === 'string') {
        genreIds = genre.split(',').map(Number); // Convertimos a un array de números
      }
      // Si 'genre' es un array de strings (ej. ["28", "12"])
      else if (Array.isArray(genre)) {
        // Mapeamos el array, asegurándonos de que cada elemento sea un string antes de convertirlo a número
        genreIds = genre
          .map((g) => (typeof g === 'string' ? Number(g) : null))
          .filter((g): g is number => g !== null); // Filtramos los nulos y aseguramos el tipo `number`
      }

      // Si hay IDs de género válidos, los añadimos a la consulta
      if (genreIds.length > 0) {
        // La clave importante aquí es 'genres.id' para consultar dentro del subdocumento
        query['genres.id'] = { $in: genreIds };
      }
    }

    // --- Manejo del filtro por Texto de Búsqueda ---
    if (searchText) {
      if (typeof searchText === 'string') { // Aseguramos que `searchText` sea un string
        query.title = { $regex: searchText, $options: 'i' }; // Búsqueda insensible a mayúsculas/minúsculas
      }
    }

    // --- Manejo de la ordenación ---
    let sortOptions: Record<string, any> = {};
    if (sortBy) {
      if (typeof sortBy === 'string') { // Aseguramos que `sortBy` sea un string
        sortOptions[sortBy] = order === 'desc' ? -1 : 1; // -1 para descendente, 1 para ascendente
      }
    }

    // Ejecutar la consulta de Mongoose
    const movies = await Movie.find(query).sort(sortOptions);

    // Si la consulta fue exitosa, enviamos las películas como respuesta
    res.json(movies);
  } catch (error: unknown) { // El tipo 'unknown' es el más seguro para errores
    console.error("Error en getFilteredMovies:", error);

    // --- Manejo de errores ---
    let errorMessage = "Ocurrió un error desconocido al cargar los filtros.";
    if (error instanceof Error) {
      // Si es una instancia de Error, usamos su mensaje
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      // Si el error es un string, lo usamos directamente
      errorMessage = error;
    }
    // Podrías añadir más lógica para errores específicos de Mongoose si lo necesitas
    else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = (error as { message: string }).message;
    }


    // Envía una respuesta de error al frontend
    res.status(500).json({ message: "Error al cargar los filtros", details: errorMessage });
  }
};