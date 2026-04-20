FROM node:20-slim

# Set the working directory in the container
WORKDIR /app

# Copy the package.json and optionally package-lock.json first
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies needed for vite build and tsx)
RUN npm install

# Copy the rest of the application files
COPY . .

# Build the Vite React frontend
RUN npm run build

# Expose the standard port configured in the app
EXPOSE 3000

# Set Node environment to production so Express serves the built /dist folder
ENV NODE_ENV=production

# The application uses better-sqlite3, which saves local DB files.
# By default, kiddie_rewards.db will be created in /app.
# You can mount a volume to /app/data and update server.ts optionally if you want to externalize it,
# but out of the box it operates exactly as the local dev environment.

# Start the application using tsx
CMD ["npx", "tsx", "server.ts"]
