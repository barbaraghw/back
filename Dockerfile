# Usa una imagen base oficial de Node.js (node:20-alpine).
FROM node:20-alpine

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia package.json y package-lock.json primero.
COPY package.json package-lock.json ./

# Ejecuta npm install para instalar todas las dependencias.
RUN npm cache clean --force
RUN npm install --production=false --force --legacy-peer-deps

# Copia TODO el código de tu aplicación, incluyendo tsconfig.json y la carpeta src.
COPY . .

# --- NUEVO PASO CRÍTICO: Añadir permisos de ejecución a los binarios ---
# Esto asegurará que tsc y otros binarios sean ejecutables.
RUN chmod +x ./node_modules/.bin/*

# --- Diagnostics (los mantenemos por ahora) ---
RUN echo "--- Listing node_modules/.bin contents AFTER CHMOD ---"
RUN ls -la ./node_modules/.bin/ || true # Revisa aquí para ver los permisos cambiados
RUN echo "--- Checking tsc permissions AFTER CHMOD ---"
RUN ls -la ./node_modules/.bin/tsc || echo "tsc not found at expected path."
RUN echo "--- Current PATH variable ---"
RUN echo $PATH
RUN echo "--- Attempting direct tsc execution ---"
RUN /app/node_modules/.bin/tsc --version || echo "Direct execution of tsc failed."
RUN echo "--- Current user ---"
RUN whoami
# --- FIN Diagnostics ---

# Ejecuta la compilación directamente.
RUN rm -rf dist && /app/node_modules/.bin/tsc

# Expone el puerto en el que tu aplicación Node.js escucha.
EXPOSE 3000

# Comando para ejecutar tu aplicación JavaScript compilada.
CMD ["node", "dist/app.js"]