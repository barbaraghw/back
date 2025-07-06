# Use a specific Node.js version as a base image.
FROM node:20-slim

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first.
COPY package.json package-lock.json ./

# --- PASOS DE INSTALACIÓN ROBUSTOS ---
RUN npm cache clean --force
RUN npm install --production=false --force --legacy-peer-deps
# --- FIN PASOS DE INSTALACIÓN ROBUSTOS ---

# --- Diagnostics (keep them in for now, can remove later) ---
RUN echo "--- Listing node_modules/.bin contents ---"
RUN ls -la ./node_modules/.bin/ || true
RUN echo "--- Checking tsc permissions ---"
RUN ls -la ./node_modules/.bin/tsc || echo "tsc not found at expected path."
RUN echo "--- Current PATH variable ---"
RUN echo $PATH
RUN echo "--- Attempting direct tsc execution ---"
RUN /app/node_modules/.bin/tsc --version || echo "Direct execution of tsc failed."
RUN echo "--- Current user ---"
RUN whoami
# --- END Diagnostics ---


# Copy the rest of your application code
COPY . .

# --- ESTE ES EL CAMBIO CRÍTICO Y FINAL ---
# En lugar de "npm run build", ejecutamos directamente la compilación.
# Primero limpiamos la carpeta 'dist', y luego llamamos a tsc con su ruta absoluta.
# Esto evita completamente el entorno de ejecución de scripts de npm para tsc.
RUN rm -rf dist && /app/node_modules/.bin/tsc

# Expone el puerto en el que tu aplicación escucha.
EXPOSE 3000

# Comando para ejecutar tu aplicación JavaScript compilada.
CMD ["node", "dist/app.js"]