// src/utils/movieImporter.ts
import Movie, { IMovieInput } from '../models/Movie';
import axios, { AxiosError } from 'axios';
import dotenv from 'dotenv';
import AppError from './AppError'; // Asegúrate de que la ruta sea correcta

dotenv.config();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

export interface TMDBMovie {
    id: number;
    title: string;
    overview: string;
    release_date: string;
    vote_average: number;
    poster_path: string | null;
    backdrop_path: string | null;
    genre_ids: number[]; // From /movie/popular
}

// Interface for the response from TMDB's /movie/{movie_id} (details endpoint)
interface TMDBDetailedMovie {
    id: number;
    title: string;
    overview: string;
    release_date: string;
    vote_average: number;
    poster_path: string | null;
    backdrop_path: string | null;
    genres: { id: number; name: string }[]; // <-- This is what we need for genres
    runtime: number | null; // <-- This is what we need for runtime
    // ... other detailed fields
}

// NEW FUNCTION: Fetch detailed movie information
export const getTmdbMovieDetails = async (tmdbId: number): Promise<TMDBDetailedMovie | null> => {
    if (!TMDB_API_KEY) {
        console.error('TMDB_API_KEY no definida en las variables de entorno.');
        return null;
    }
    try {
        const response = await axios.get<TMDBDetailedMovie>(`${TMDB_BASE_URL}/movie/${tmdbId}`, {
            params: {
                api_key: TMDB_API_KEY,
                language: 'es-ES',
            },
        });
        return response.data;
    } catch (error) {
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 404) {
            console.warn(`Movie with TMDB ID ${tmdbId} not found on TMDB. Skipping detailed fetch.`);
        } else {
            console.error(`Error fetching detailed TMDB movie ${tmdbId}:`, axiosError.message);
        }
        return null;
    }
};

// MODIFIED formatTmdbMovie to handle both TMDBMovie and TMDBDetailedMovie
export const formatTmdbMovie = (
    tmdbMovie: TMDBMovie | TMDBDetailedMovie, // <-- Accepts both types now
    isDetailed: boolean = false // <-- New flag to indicate if it's detailed data
): IMovieInput | null => {
    if (!tmdbMovie.title || !tmdbMovie.id || !tmdbMovie.release_date) {
        console.warn('Skipping TMDB movie due to missing essential data:', tmdbMovie);
        return null;
    }

    let releaseDate: Date | undefined;
    try {
        releaseDate = new Date(tmdbMovie.release_date);
        if (isNaN(releaseDate.getTime())) {
            console.warn(`Invalid release date for movie ${tmdbMovie.title} (${tmdbMovie.id}): ${tmdbMovie.release_date}`);
            releaseDate = undefined;
        }
    } catch (e) {
        console.warn(`Error parsing release date for movie ${tmdbMovie.title} (${tmdbMovie.id}): ${e}`);
        releaseDate = undefined;
    }

    const formattedMovie: IMovieInput = {
        title: tmdbMovie.title,
        tmdbId: tmdbMovie.id.toString(),
        overview: tmdbMovie.overview || 'No overview available.',
        release_date: releaseDate || new Date('1900-01-01'),
        vote_average: tmdbMovie.vote_average || 0,
        poster_path: tmdbMovie.poster_path ? `${IMAGE_BASE_URL}${tmdbMovie.poster_path}` : '',
        backdrop_path: tmdbMovie.backdrop_path ? `${IMAGE_BASE_URL}${tmdbMovie.backdrop_path}` : '',
        // *** CRITICAL CHANGE HERE ***
        // Conditionally assign genres based on the input type
        genres: isDetailed && 'genres' in tmdbMovie ? tmdbMovie.genres : [], // Use detailed genres if available
        runtime: isDetailed && 'runtime' in tmdbMovie ? tmdbMovie.runtime || undefined : undefined, // Use detailed runtime if available
    };
    return formattedMovie;
};

/**
 * Imports popular movies from TMDB and saves them to the database.
 * Can be run automatically on server startup or manually via an API endpoint.
 * @param maxPagesToImport The maximum number of pages to import. Default is 5.
 * @returns The number of new movies inserted.
 */
export const importPopularMovies = async (maxPagesToImport: number = 5): Promise<number> => {
    if (!TMDB_API_KEY) {
        console.error('Error: TMDB_API_KEY no está definida. No se pueden importar películas.');
        throw new AppError('Error de configuración del servidor: La clave API de TMDB no está definida.', 500);
    }

    console.log(`Iniciando importación de películas populares de TMDB (hasta ${maxPagesToImport} páginas)...`);

    try {
        let page = 1;
        let totalPages = 1;
        // const moviesToInsert: IMovieInput[] = []; // We will directly insert/update now

        while (page <= totalPages && page <= maxPagesToImport) {
            console.log(`Importando página ${page} de películas populares de TMDB...`);
            const tmdbResponse = await axios.get(`${TMDB_BASE_URL}/movie/popular`, {
                params: {
                    api_key: TMDB_API_KEY,
                    language: 'es-ES',
                    page: page,
                },
            });

            if (!tmdbResponse.data || !Array.isArray(tmdbResponse.data.results)) {
                console.error('TMDB response for popular movies is not in expected format:', tmdbResponse.data);
                throw new AppError('TMDB response for popular movies is not in expected format.', 500);
            }

            const tmdbMovies: TMDBMovie[] = tmdbResponse.data.results;
            totalPages = tmdbResponse.data.total_pages;

            for (const tmdbMovie of tmdbMovies) {
                // Fetch detailed movie data for genres and runtime
                const detailedTmdbMovie = await getTmdbMovieDetails(tmdbMovie.id);

                // Use the detailed movie if available, otherwise fallback to the basic one
                // And pass the `isDetailed` flag to the formatter
                const movieToFormat = detailedTmdbMovie || tmdbMovie;
                const formattedMovie = formatTmdbMovie(movieToFormat, !!detailedTmdbMovie); // Pass true if detailedTmdbMovie exists

                if (formattedMovie) {
                    const existingMovie = await Movie.findOne({ tmdbId: formattedMovie.tmdbId });
                    if (!existingMovie) {
                        await Movie.create(formattedMovie); // Insert new movie directly
                        // moviesToInsert.push(formattedMovie); // No longer collecting in array
                        console.log(`Inserted new movie: ${formattedMovie.title}`);
                    } else {
                        // Update existing movie with potentially more complete data (genres, runtime)
                        await Movie.updateOne(
                            { tmdbId: formattedMovie.tmdbId },
                            {
                                $set: {
                                    overview: formattedMovie.overview,
                                    release_date: formattedMovie.release_date,
                                    vote_average: formattedMovie.vote_average,
                                    poster_path: formattedMovie.poster_path,
                                    backdrop_path: formattedMovie.backdrop_path,
                                    genres: formattedMovie.genres, // Update genres
                                    runtime: formattedMovie.runtime, // Update runtime
                                    // Add any other fields you want to update on existing movies
                                }
                            }
                        );
                        console.log(`Updated existing movie: ${formattedMovie.title}`);
                    }
                }
            }
            page++;
        }

        // Removed the insertMany logic as movies are now inserted/updated individually in the loop
        console.log('Importación de películas populares completada.');
        // You might want to return the actual count of newly inserted/updated movies here.
        // For simplicity, returning 0 or adjusting the counter logic.
        return 0; // Or calculate the actual count if you add a counter inside the loop

    } catch (error: any) {
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;
            console.error('Error de Axios al importar películas populares:', axiosError.message);
            if (axiosError.response) {
                console.error('TMDB Response Status:', axiosError.response.status);
                console.error('TMDB Response Data:', axiosError.response.data);
                if (axiosError.response.status === 401 || axiosError.response.status === 403) {
                    throw new AppError('Error de autenticación con TMDB. Verifica tu clave API.', 401);
                } else if (axiosError.response.status === 404) {
                    throw new AppError('Recurso no encontrado en TMDB. URL de TMDB incorrecta.', 404);
                } else if (axiosError.response.status >= 500) {
                    throw new AppError('Error del servidor de TMDB. Inténtalo de nuevo más tarde.', 502);
                }
            } else if (axiosError.request) {
                console.error('No se recibió respuesta de TMDB. Problema de red o CORS:', axiosError.message);
                throw new AppError('No se pudo conectar con el servidor de TMDB. Verifica tu conexión.', 504);
            }
            console.error('Error al configurar la solicitud a TMDB:', axiosError.message);
            throw new AppError('Error al preparar la solicitud a TMDB.', 500);
        }

        console.error('Error inesperado al importar películas populares:', error);
        throw new AppError('Error interno del servidor.', 500);
    }
};