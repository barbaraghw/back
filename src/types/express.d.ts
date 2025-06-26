import { IUser } from '../models/User';

import { IAuthenticatedUser } from './authenticatedUser';

declare global {
  namespace Express {
    // Extiende la interfaz Request para añadir propiedades y métodos específicos de Passport
    export interface Request {
      user?: IAuthenticatedUser; // Propiedad añadida por Passport al autenticar

      // Métodos de Passport añadidos a Request
      login(user: IUser, options: Record<string, any>, callback?: (err: Error | undefined) => void): void;
      logout(callback?: (err: Error) => void): void;
      isAuthenticated(): boolean;
      isUnauthenticated(): boolean;
    }
  }
}