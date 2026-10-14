FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm ci --prefix frontend

COPY frontend ./frontend
RUN npm run build --prefix frontend

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --omit=dev --prefix backend

COPY backend/server.js ./backend/server.js
COPY frontend/shared ./frontend/shared
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

USER node
EXPOSE 3000
CMD ["node", "backend/server.js"]
