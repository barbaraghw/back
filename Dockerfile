FROM node:20-slim

WORKDIR /app

# 1. Copia solo los archivos necesarios para instalar dependencias
COPY package.json package-lock.json ./

# 2. Instala dependencias (incluyendo TypeScript)
RUN npm install --production=false

# 3. Asegura permisos de ejecución para tsc
RUN chmod +x ./node_modules/.bin/tsc

# 4. Verifica que tsc sea ejecutable (opcional, para debug)
RUN ls -la ./node_modules/.bin/tsc && ./node_modules/.bin/tsc --version

# 5. Copia el resto del código
COPY . .

# 6. Compila con la ruta completa a tsc
RUN rm -rf dist && ./node_modules/.bin/tsc

EXPOSE 3000
CMD ["node", "dist/app.js"]