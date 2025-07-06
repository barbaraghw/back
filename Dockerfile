# Use a specific Node.js version as a base image
FROM node:20-slim

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first
COPY package.json package-lock.json ./

# Install dependencies
RUN npm cache clean --force && \
    npm install --production=false --force --legacy-peer-deps

# Fix permissions for node_modules binaries
RUN chmod -R +x ./node_modules/.bin/

# Copy the rest of your application code
COPY . .

# Clean dist and run TypeScript compiler
RUN rm -rf dist && tsc

# Expose the port your app listens on
EXPOSE 3000

# Command to run your compiled JavaScript application
CMD ["node", "dist/app.js"]