FROM node:20-alpine AS build

WORKDIR /usr/src/app

COPY package*.json .
RUN npm ci --omit=dev

COPY . .

FROM node:20-alpine

WORKDIR /usr/src/app

COPY --from=build /usr/src/app .

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

CMD ["node", "index.js"]
