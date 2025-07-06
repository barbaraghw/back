FROM node:20-alpine

WORKDIR /app

# Establece permisos correctos desde el inicio
USER root
RUN chown -R node:node /app
USER node

# Copia archivos de dependencias
COPY --chown=node:node package.json package-lock.json ./

# Instala dependencias
RUN npm install --production=false

# Verifica TypeScript
RUN ls -la ./node_modules/.bin/tsc && ./node_modules/.bin/tsc --version

# Copia el resto con permisos correctos
COPY --chown=node:node . .

# Compilación
RUN rm -rf dist && ./node_modules/.bin/tsc

EXPOSE 3000
CMD ["node", "dist/app.js"]