FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./

# Install dependencies including devDependencies
RUN npm install --production=false

# Verify tsc is available
RUN ls -la node_modules/.bin/tsc && \
    chmod +x node_modules/.bin/tsc && \
    ./node_modules/.bin/tsc --version

COPY . .

# Build using the local tsc
RUN rm -rf dist && ./node_modules/.bin/tsc

EXPOSE 3000
CMD ["node", "dist/app.js"]