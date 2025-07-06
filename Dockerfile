FROM node:20-slim

WORKDIR /app

# 1. Copia archivos de dependencias primero
COPY package.json package-lock.json ./

# 2. Instala dependencias (incluyendo TypeScript)
RUN npm install --production=false

# 3. Verificación crítica (opcional para debug)
RUN echo "=== Verificando tsc ===" && \
    ls -la ./node_modules/.bin/tsc* && \
    npx tsc --version

# 4. Copia todo el código fuente
COPY . .

# 5. Compilación con npx (¡Solución clave!)
RUN rm -rf dist && npx tsc

EXPOSE 3000
CMD ["node", "dist/app.js"]