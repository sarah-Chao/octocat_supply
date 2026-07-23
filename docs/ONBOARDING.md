# Onboarding Guide – OctoCAT Supply Chain

Welcome to the OctoCAT Supply Chain Management application.
This guide covers everything you need to get a working development environment,
understand the project structure, and contribute new features confidently.

---

## Table of contents

1. [Prerequisites](#prerequisites)
2. [Local setup](#local-setup)
3. [Architecture overview](#architecture-overview)
4. [Running the application](#running-the-application)
5. [Running tests](#running-tests)
6. [Adding a new API endpoint](#adding-a-new-api-endpoint)
7. [Troubleshooting](#troubleshooting)
8. [Further reading](#further-reading)

---

## Prerequisites

| Tool | Minimum version | Notes |
|---|---|---|
| Node.js | 20 | Required for both `api/` and `frontend/` |
| npm | 10 | Comes with Node.js |
| make | any | Used for all root-level convenience targets |
| Git | 2.x | |

> If you are using the included **dev container** (`.devcontainer/`), all of the
> above are pre-installed and no manual setup is required.

---

## Local setup

### 1. Clone the repository

```bash
git clone https://github.com/copilot-academy/octocat_supply.git
cd octocat_supply
```

### 2. Install dependencies

```bash
make install
```

This installs npm packages for both `api/` and `frontend/` in one step.
To install only one workspace:

```bash
cd api && npm install
# or
cd frontend && npm install
```

### 3. Seed the database

The API uses SQLite. The database file is created automatically on first run,
but you can pre-populate it with sample data:

```bash
make db-seed
# equivalent to: cd api && npm run db:seed
```

The database file is written to `api/data/app.db`.
This path can be overridden with the `DB_FILE` environment variable.

### Environment variables

All environment variables are optional and have safe defaults:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | API listen port |
| `DB_FILE` | `./data/app.db` | SQLite database file path |
| `DB_ENABLE_WAL` | `true` | Enable WAL journal mode |
| `DB_FOREIGN_KEYS` | `true` | Enable foreign-key constraints |
| `DB_TIMEOUT` | `30000` | Statement timeout in milliseconds |
| `API_CORS_ORIGINS` | _(see below)_ | Comma-separated list of allowed CORS origins |
| `NODE_ENV` | `development` | Set to `test` by Vitest automatically |
| `VITE_API_URL` | _(auto-detected)_ | Frontend API base URL; auto-detected in Codespaces |

Default CORS origins (when `API_CORS_ORIGINS` is not set):
`http://localhost:5137`, `http://localhost:3001`, `*.app.github.dev`, `*.azurecontainerapps.io`

---

## Architecture overview

```
octocat_supply/
├── api/                    Express REST API (TypeScript, SQLite)
│   ├── src/
│   │   ├── index.ts        Application entry point
│   │   ├── init-db.ts      Migration + seed runner (CLI and startup)
│   │   ├── db/             Database connection, config, migration, seed
│   │   ├── models/         TypeScript interfaces (one per entity)
│   │   ├── repositories/   Data-access classes (one per entity)
│   │   ├── routes/         Express routers (one per entity)
│   │   └── utils/          Shared error types and SQL helpers
│   └── database/
│       ├── migrations/     Numbered SQL migration files
│       └── seed/           Numbered SQL seed files
├── frontend/               React + Vite + Tailwind UI
│   └── src/
│       ├── api/            Axios config and base URL resolution
│       ├── components/     React components
│       └── context/        Auth, Cart, and Theme contexts
├── docs/                   Architecture and reference documentation
└── Makefile                Convenience targets for all workflows
```

**Request flow:** `HTTP client → Express route → Repository → DatabaseConnection (better-sqlite3) → SQLite`

For a detailed sequence diagram see [architecture-suppliers.md](architecture-suppliers.md).
For the full database schema see [database-schema.md](database-schema.md).

---

## Running the application

### Development (API + frontend, hot-reload)

```bash
make dev
```

This starts both servers concurrently:
- API: `http://localhost:3000`
- Frontend: `http://localhost:3001` (or whichever port Vite selects)
- Swagger UI: `http://localhost:3000/api-docs`

To start each server independently:

```bash
make dev-api        # API only
make dev-frontend   # Frontend only
```

### Production build

```bash
make build          # compile api/ (tsc) + frontend/ (vite build)
make build-api      # API only
make build-frontend # Frontend only
```

### Docker Compose

```bash
docker compose up
```

- API exposed on `localhost:3000`
- Frontend exposed on `localhost:3001`

---

## Running tests

### All API unit tests (watch mode)

```bash
cd api && npm test
# or
make test-api
```

### Single test file

```bash
cd api && npx vitest run src/repositories/suppliersRepo.test.ts
```

### With coverage

```bash
cd api && npm run test:coverage
# or
make test-coverage
```

Coverage reports are written to `api/coverage/`.
The CI-readable summary is at `api/coverage/coverage-summary.json`.

### End-to-end tests (Playwright)

```bash
make test-e2e
# equivalent to: cd frontend && npm run test:e2e
```

### Route integration tests

Route test files (e.g. `api/src/routes/branch.test.ts`) use an in-memory
SQLite database. They call `getDatabase(true)` and run `runMigrations(true)`
in `beforeEach`, so they are fully isolated and require no external state.

---

## Adding a new API endpoint

Follow these four steps for every new entity. Use the existing
`api/src/routes/supplier.ts` and `api/src/repositories/suppliersRepo.ts` as reference.

### Step 1 – Write the database migration

Create a new file in `api/database/migrations/` following the numbering convention:

```
api/database/migrations/003_create_warehouses.sql
```

```sql
CREATE TABLE warehouses (
    warehouse_id   INTEGER PRIMARY KEY,
    name           TEXT NOT NULL,
    address        TEXT
);
```

Migrations run in filename order and are applied only once (tracked in the
`migrations` table).

### Step 2 – Define the TypeScript model

Create `api/src/models/warehouse.ts`:

```typescript
/**
 * @swagger
 * components:
 *   schemas:
 *     Warehouse:
 *       type: object
 *       required:
 *         - warehouseId
 *         - name
 *       properties:
 *         warehouseId:
 *           type: integer
 *         name:
 *           type: string
 *         address:
 *           type: string
 */
export interface Warehouse {
  warehouseId: number;
  name: string;
  address?: string;
}
```

Key conventions:
- Primary key: `{entityName}Id` in camelCase
- DB columns are `snake_case`; models use `camelCase` (conversion handled by `mapDatabaseRows` / `objectToCamelCase`)
- Boolean flags stored as `INTEGER 0/1` in SQLite; convert with `Boolean()` in the repository

### Step 3 – Create the repository

Create `api/src/repositories/warehousesRepo.ts`:

```typescript
import { getDatabase, DatabaseConnection } from '../db/sqlite';
import { Warehouse } from '../models/warehouse';
import { handleDatabaseError, NotFoundError } from '../utils/errors';
import { buildInsertSQL, buildUpdateSQL, objectToCamelCase, mapDatabaseRows, DatabaseRow } from '../utils/sql';

export class WarehousesRepository {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  async findAll(): Promise<Warehouse[]> {
    try {
      const rows = await this.db.all<DatabaseRow>('SELECT * FROM warehouses ORDER BY warehouse_id');
      return mapDatabaseRows<Warehouse>(rows);
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  // ... findById, create, update, delete, exists following the same pattern
}

let warehousesRepo: WarehousesRepository | null = null;

export async function getWarehousesRepository(isTest = false): Promise<WarehousesRepository> {
  const isTestEnv = isTest || process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  if (isTestEnv) {
    const db = await getDatabase(true);
    return new WarehousesRepository(db);
  }
  if (!warehousesRepo) {
    const db = await getDatabase(false);
    warehousesRepo = new WarehousesRepository(db);
  }
  return warehousesRepo;
}
```

### Step 4 – Create the route and register it

Create `api/src/routes/warehouse.ts` with Swagger JSDoc comments and Express
handlers that call repository methods, then pass errors to `next(error)`:

```typescript
import express from 'express';
import { getWarehousesRepository } from '../repositories/warehousesRepo';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const repo = await getWarehousesRepository();
    res.json(await repo.findAll());
  } catch (error) {
    next(error);
  }
});

export default router;
```

Register the router in `api/src/index.ts`:

```typescript
import warehouseRoutes from './routes/warehouse';
// ...
app.use('/api/warehouses', warehouseRoutes);
```

### Step 5 – Write tests

Add `api/src/repositories/warehousesRepo.test.ts` (unit, mock DB) and
optionally `api/src/routes/warehouse.test.ts` (integration, in-memory SQLite).
See `api/src/repositories/suppliersRepo.test.ts` and
`api/src/routes/branch.test.ts` for the established patterns.

---

## Troubleshooting

### `SQLITE_CANTOPEN` or database file not found

The `api/data/` directory is created automatically, but if the process lacks
write permission:

```bash
mkdir -p api/data
```

Or override the path: `DB_FILE=/tmp/app.db npm run dev`

### Port already in use (EADDRINUSE)

The API defaults to port `3000`. Change it:

```bash
PORT=3001 npm run dev   # inside api/
```

### Frontend cannot reach the API

In local development the frontend auto-detects the API URL:
1. Checks `window.RUNTIME_CONFIG.API_URL` (set by `frontend/public/runtime-config.js` in production)
2. In a Codespace, constructs `https://${CODESPACE_NAME}-3000.app.github.dev`
3. Falls back to `http://localhost:3000`

If the API is running on a non-default port, set `VITE_API_URL` before starting
the frontend:

```bash
VITE_API_URL=http://localhost:3001 npm run dev
```

### CORS errors in the browser

The API allows `localhost:5137`, `localhost:3001`, and all `*.app.github.dev`
domains by default. To add another origin:

```bash
API_CORS_ORIGINS=http://localhost:4000,http://localhost:3001 npm run dev
```

### Migrations not applying

Migrations are tracked in the `migrations` table inside `app.db`. If you need
to re-run from scratch, delete the database file:

```bash
rm api/data/app.db
make db-seed
```

### Tests fail with `SQLITE_ERROR: no such table`

Route integration tests call `runMigrations(true)` in `beforeEach` against an
in-memory database. If you add a new migration, existing tests that do not
seed their own required rows will fail. Ensure `beforeEach` inserts any
required foreign-key rows before the test body runs (see `branch.test.ts` for
an example).

### TypeScript compilation errors after adding a model

Run `npm run build` inside `api/` to surface type errors before committing.
The `dev` script uses `tsx` and skips the TypeScript compiler, so build errors
can go unnoticed during development.

---

## Further reading

| Document | Description |
|---|---|
| [docs/architecture-suppliers.md](architecture-suppliers.md) | Sequence diagram and error-flow for the suppliers module |
| [docs/database-schema.md](database-schema.md) | ERD with all tables, columns, foreign keys, and indexes |
| [docs/architecture.md](architecture.md) | High-level system architecture |
| [docs/sqlite-integration.md](sqlite-integration.md) | SQLite-specific integration notes |
| [docs/build.md](build.md) | Build system and CI details |
| [docs/deployment.md](deployment.md) | Deployment to Azure Container Apps |
| `api/src/routes/supplier.ts` | Reference implementation of a route |
| `api/src/repositories/suppliersRepo.ts` | Reference implementation of a repository |
| `http://localhost:3000/api-docs` | Live Swagger UI (when API is running) |
