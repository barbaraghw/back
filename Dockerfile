# Usa una imagen base oficial de Node.js (ahora con alpine como has cambiado).
FROM node:20-alpine

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# 1. Copia package.json y package-lock.json primero.
#    Esto aprovecha la caché de Docker para npm install.
COPY package.json package-lock.json ./

# 2. Ejecuta npm install para instalar todas las dependencias.
RUN npm cache clean --force
RUN npm install --production=false --force --legacy-peer-deps

# --- ESTE ES EL CAMBIO CRÍTICO: Copiar el código AHORA ---
# 3. Copia TODO el código de tu aplicación, incluyendo tsconfig.json y la carpeta src.
#    ¡Esto DEBE hacerse ANTES de intentar compilar con tsc!
COPY . .
# --- FIN CAMBIO CRÍTICO ---

# --- Diagnostics (los mantenemos por si acaso, pero deberían ser consistentes ahora) ---
RUN echo "--- Listing node_modules/.bin contents ---"
RUN ls -la ./node_modules/.bin/ || true
RUN echo "--- Checking tsc permissions ---"
RUN ls -la ./node_modules/.bin/tsc || echo "tsc not found at expected path."
RUN echo "--- Current PATH variable ---"
RUN echo $PATH
RUN echo "--- Attempting direct tsc execution ---"
# Esta prueba ahora debería ejecutar tsc con tu tsconfig.json presente.
RUN /app/node_modules/.bin/tsc --version || echo "Direct execution of tsc failed."
RUN echo "--- Current user ---"
RUN whoami
# --- FIN Diagnostics ---

# 4. Ahora sí, ejecuta la compilación.
#    `tsc` debería encontrar tsconfig.json y tus archivos fuente.
RUN rm -rf dist && /app/node_modules/.bin/tsc

# Expone el puerto en el que tu aplicación Node.js escucha.
EXPOSE 3000

# Comando para ejecutar tu aplicación JavaScript compilada.
CMD ["node", "dist/app.js"]