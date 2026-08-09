# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /usr/src/app
COPY package*.json .
RUN npm ci --omit=dev
COPY . .

# --- Runtime stage (smaller final image, no build tools) ---
FROM node:20-alpine
WORKDIR /usr/src/app
COPY --from=build /usr/src/app .

# Run as non-root user (security best practice)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000
CMD ["node", "index.js"]
