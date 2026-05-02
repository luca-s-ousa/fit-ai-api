# Repository Guidelines

## Project Structure & Module Organization
`src/index.ts` boots the Fastify server, Swagger docs, and auth handler. Keep HTTP concerns in `src/routes/`, business logic in `src/usecases/`, shared helpers in `src/lib/`, reusable Zod schemas in `src/schemas/`, and custom errors in `src/errors/`. Prisma schema and migrations live in `prisma/`; generated client code is written to `src/generated/prisma/`. Treat `dist/` as build output and do not edit it by hand.

## Build, Test, and Development Commands
Use Node `24.x` and npm.

- `docker compose up -d postgres`: start the local PostgreSQL service on `5432`.
- `npm run dev`: run the API with `tsx --watch` from `src/index.ts`.
- `npm run build`: compile TypeScript into `dist/`.
- `npx prisma migrate dev`: apply local schema changes and create a migration.
- `npx eslint .`: run the TypeScript/ESLint checks.
- `npm run commit`: open Commitizen for a conventional commit message.

## Coding Style & Naming Conventions
This repo is strict TypeScript with ESM. Follow the rules in `rules/typescript.md` and `rules/architecture.md`: avoid `any`, prefer named exports, use arrow functions, and choose early returns over deep nesting. Use `camelCase` for variables/functions, `PascalCase` for classes and use case files (for example `CreateWorkoutPlan.ts`), and `kebab-case` for other files such as `workout-plan.ts`. Keep routes thin: validate with Zod v4, authenticate when needed, then delegate to a use case.

## Testing Guidelines
There is no first-party test suite or `npm test` script yet. Until one is added, contributors should verify changes with `npm run build`, `npx eslint .`, and manual API checks through `http://localhost:8081/docs`. If you add automated tests, include the test command in the same PR and keep coverage focused on route validation and use case behavior.

## Commit & Pull Request Guidelines
Git history uses Conventional Commits such as `feat:` and `fix:`. Keep the subject imperative and scoped to one change, for example `feat: add stats endpoint`. For pull requests, include a short summary, note schema or migration changes, list verification steps, and attach request/response examples when an endpoint contract changes.

## Security & Configuration Tips
Secrets live in `.env`; never commit real credentials. `prisma.config.ts` reads `DATABASE_URL` from the environment, and auth routes depend on the same runtime configuration. Review generated Prisma artifacts after schema changes, but do not hand-edit generated files.
