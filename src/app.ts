import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import movieImportRoutes from './routes/movieImportRoutes';
import movieRoutes from './routes/movieRoutes';
import commentRoutes from './routes/commentRoutes';
import AppError from './utils/AppError'; // Adjust path
import './config/passport'; // 
import { importPopularMovies } from './utils/movieImporter';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mi-proyecto-movil-db';

// Middleware
app.use(express.json()); // Para parsear JSON en las peticiones

// Conexión a MongoDB
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB conectado exitosamente');
    // Llama a la función de importación de películas aquí
    // Esto se ejecutará una vez que el servidor se conecte a la DB
    importPopularMovies(15) // Importa 5 páginas de películas al inicio
      .then(importedCount => {
        console.log(`Importación inicial automática completada. Se insertaron ${importedCount} películas nuevas.`);
      })
      .catch(err => {
        console.error('Error durante la importación inicial automática:', err);
      });

    // Inicia el servidor solo después de intentar la importación inicial
    app.listen(PORT, () => {
      console.log(`Servidor escuchando en el puerto ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Error de conexión a MongoDB:', err);
    process.exit(1); // Sale de la aplicación si no puede conectar a la DB
  });
  
// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/import-movies', movieImportRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/comments', commentRoutes);


// Manejo de errores (opcional, pero recomendado)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).send('¡Algo salió mal!');
});

app.get('/', (req, res) => {
  res.send('API de películas en funcionamiento!');
});

