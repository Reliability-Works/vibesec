FROM node:20-slim AS build

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages

RUN corepack enable && corepack prepare pnpm@10.27.0 --activate
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app /app

ENTRYPOINT ["node", "/app/packages/cli/dist/cli.js"]
CMD ["scan", "."]
