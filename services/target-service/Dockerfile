FROM node:22-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/target-service/package.json ./services/target-service/package.json
RUN corepack enable && pnpm install --filter profile-volume-target --prod --frozen-lockfile
COPY services/target-service/src ./services/target-service/src
WORKDIR /app/services/target-service
USER node
EXPOSE 8080
CMD ["node", "src/server.mjs"]
