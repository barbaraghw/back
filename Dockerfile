# Usa una imagen base oficial de Node.js.
# Es buena práctica especificar una versión que uses localmente.
# 'slim' es para un tamaño de imagen más pequeño. Node 20 es una versión LTS reciente.
FROM node:20-slim

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia package.json y package-lock.json (o yarn.lock si lo usas) primero.
# Esto aprovecha la caché de Docker: si estos archivos no cambian,
# el paso de 'npm install' no se ejecutará de nuevo, lo que acelera los builds.
COPY package.json package-lock.json ./

# Instala todas las dependencias, incluyendo las de desarrollo.
# Aquí no usamos --production=false porque el 'npm install' básico en un Dockerfile
# sin el flag --production instala TODAS las dependencias por defecto.
# Esto asegura que 'typescript' se instale y 'tsc' esté disponible.
RUN npm install

# Copia el resto del código de tu aplicación
COPY . .

# Ejecuta el script 'build' definido en tu package.json.
# Esto compilará tu TypeScript a JavaScript (típicamente en la carpeta 'dist').
RUN npm run build

# Opcional: Si quieres una imagen final más pequeña para producción,
# puedes eliminar las devDependencies después del build.
# RUN npm prune --production

# Expone el puerto en el que tu aplicación Node.js escucha.
# Tu código debe escuchar en process.env.PORT (que Railway inyectará)
# o un puerto predeterminado como 3000.
EXPOSE 3000

# Comando para ejecutar tu aplicación JavaScript compilada.
# Asegúrate de que "dist/app.js" sea la ruta correcta a tu archivo principal compilado
# dentro del contenedor (relativa a /app).
CMD ["node", "dist/app.js"]