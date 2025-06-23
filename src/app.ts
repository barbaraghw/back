import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import './config/passport'; // Importar la configuración de Passport

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mi-proyecto-movil-db';

// Middleware
app.use(express.json()); // Para parsear JSON en las peticiones

// Conexión a MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB conectado exitosamente'))
  .catch(err => console.error('Error de conexión a MongoDB:', err));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
// ... otras rutas

// Manejo de errores (opcional, pero recomendado)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).send('¡Algo salió mal!');
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});