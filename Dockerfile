# QUORUM: one small container, no build step, no npm packages.
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
RUN mkdir -p /data && chown node:node /data
ENV PORT=3000 DATA_DIR=/data NODE_ENV=production
EXPOSE 3000
VOLUME ["/data"]
USER node
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/info >/dev/null || exit 1
CMD ["node", "src/server.js"]
