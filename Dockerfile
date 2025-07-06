FROM node:20-alpine

WORKDIR /app

# 1. Configurar usuario y permisos adecuados
USER root
RUN chown -R node:node /app
USER node

# 2. Copiar e instalar dependencias
COPY --chown=node:node package.json package-lock.json ./
RUN npm install --production=false --force

# 3. Solución clave: Usar la ruta directa al binario de TypeScript
RUN rm -rf dist && ./node_modules/typescript/bin/tsc

# 4. Copiar el resto del código
COPY --chown=node:node . .

# 5. Compilar usando la ruta directa
RUN rm -rf dist && ./node_modules/typescript/bin/tsc

EXPOSE 3000
CMD ["node", "dist/app.js"]