# Usa una imagen base oficial de Node.js que sea LTS y 'slim' para un menor tamaño.
FROM node:20-slim

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia package.json y package-lock.json primero.
# Esto es para aprovechar la caché de Docker para el paso de instalación.
COPY package.json package-lock.json ./

# --- INICIO: PASOS DE INSTALACIÓN ROBUSTOS ---

# 1. Limpia la caché de npm para evitar cualquier módulo corrupto o incompleto en caché.
RUN npm cache clean --force

# 2. Reinstala todas las dependencias (incluyendo devDependencies) con fuerza.
#    --legacy-peer-deps puede ayudar a evitar problemas con dependencias pares.
#    --force forza la reinstalación de todos los paquetes.
RUN npm install --production=false --force --legacy-peer-deps

# 3. Asegura explícitamente que el binario 'tsc' sea ejecutable.
#    Esto es un "seguro" extra si por alguna razón los permisos no se establecieron correctamente.
#    'sh -c' es para asegurar que el comando se interprete en un shell.
#    'find' busca el archivo 'tsc' dentro de node_modules/.bin y le da permisos de ejecución.
#    El '|| true' evita que el build falle si 'tsc' aún no se encuentra (aunque debería estar).
RUN sh -c "find ./node_modules/.bin -name 'tsc' -exec chmod +x {} +" || true

# --- FIN: PASOS DE INSTALACIÓN ROBUSTOS ---

# Copia el resto del código de tu aplicación
COPY . .

# Ejecuta el script 'build' definido en tu package.json.
# Esto compilará tu TypeScript a JavaScript.
RUN npm run build

# Expone el puerto en el que tu aplicación escucha.
EXPOSE 3000

# Comando para ejecutar tu aplicación JavaScript compilada.
# ASEGÚRATE de que "dist/app.js" es la ruta correcta a tu archivo principal compilado
# dentro del contenedor (relativa a /app). NO uses rutas de Windows/locales aquí.
CMD ["node", "dist/app.js"]