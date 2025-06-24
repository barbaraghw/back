    // src/utils/movieImporter.ts
    import Movie, { IMovieInput } from '../models/Movie';
    import axios, { AxiosError } from 'axios';
    import dotenv from 'dotenv';
    import AppError from './AppError'; // Asegúrate de que la ruta sea correcta

    dotenv.config();

    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
    const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

  export  interface TMDBMovie {
        id: number;
        title: string;
        overview: string;
        release_date: string;
        vote_average: number;
        poster_path: string | null;
        backdrop_path: string | null;
        genre_ids: number[];
    }

  export  const formatTmdbMovie = (tmdbMovie: TMDBMovie): IMovieInput | null => {
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
            genres: tmdbMovie.genre_ids || [],
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
        const moviesToInsert: IMovieInput[] = [];

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
                const formattedMovie = formatTmdbMovie(tmdbMovie);
                if (formattedMovie) {
                    const existingMovie = await Movie.findOne({ tmdbId: formattedMovie.tmdbId });
                    if (!existingMovie) {
                        moviesToInsert.push(formattedMovie);
                    }
                }
            }
            page++;
        }

        if (moviesToInsert.length > 0) {
            try {
                const insertedDocs = await Movie.insertMany(moviesToInsert as any[], { ordered: false });
                const insertedCount = insertedDocs.length;
                console.log(`Se insertaron ${insertedCount} películas nuevas en la base de datos.`);
                return insertedCount;
            } catch (mongoError: any) {
                if (mongoError.code === 11000) {
                    console.warn('Advertencia de inserción: Algunas películas ya existían (posiblemente un duplicado) y no se reinsertaron.');
                    const insertedCount = moviesToInsert.length - (mongoError.writeErrors ? mongoError.writeErrors.length : 0);
                    return insertedCount;
                }
                console.error('Error al insertar películas en la base de datos:', mongoError);
                throw new AppError('Error interno del servidor al guardar películas.', 500);
            }
        }
        
        console.log('No se encontraron películas nuevas para importar o ya existen todas en la base de datos.');
        return 0;

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