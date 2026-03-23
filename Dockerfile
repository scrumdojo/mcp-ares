FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist

EXPOSE 3000
ENTRYPOINT ["node", "dist/index.js"]
