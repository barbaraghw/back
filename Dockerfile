# Usa una imagen base oficial de Node.js que sea LTS y 'slim' para un menor tamaño.
FROM node:20-slim

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia package.json y package-lock.json (o yarn.lock si lo usas) primero.
# Esto aprovecha la caché de Docker para el paso de instalación.
COPY package.json package-lock.json ./

# --- PASOS DE INSTALACIÓN ROBUSTOS ---
RUN npm cache clean --force
RUN npm install --production=false --force --legacy-peer-deps
# --- FIN PASOS DE INSTALACIÓN ROBUSTOS ---


# --- INICIO: DIAGNÓSTICOS AVANZADOS ---

# 1. Lista el contenido de node_modules/.bin para verificar si tsc está allí
RUN echo "--- Listing node_modules/.bin contents ---"
RUN ls -la ./node_modules/.bin/ || true

# 2. Verifica la existencia de tsc y sus permisos exactos
RUN echo "--- Checking tsc permissions ---"
RUN ls -la ./node_modules/.bin/tsc || echo "tsc not found at expected path."

# 3. Muestra el PATH actual del shell (importante para "command not found")
RUN echo "--- Current PATH variable ---"
RUN echo $PATH

# 4. Intenta ejecutar tsc directamente usando su ruta absoluta
#    Esto nos dirá si es un problema de PATH o de ejecución del binario.
RUN echo "--- Attempting direct tsc execution ---"
RUN /app/node_modules/.bin/tsc --version || echo "Direct execution of tsc failed."

# 5. Muestra el usuario actual
RUN echo "--- Current user ---"
RUN whoami

# --- FIN: DIAGNÓSTICOS AVANZADOS ---


# Copia el resto del código de tu aplicación
COPY . .

# Ejecuta el script 'build' definido en tu package.json.
# Esto compilará tu TypeScript a JavaScript.
RUN npm run build

# Expone el puerto en el que tu aplicación escucha.
EXPOSE 3000

# Comando para ejecutar tu aplicación JavaScript compilada.
CMD ["node", "dist/app.js"]