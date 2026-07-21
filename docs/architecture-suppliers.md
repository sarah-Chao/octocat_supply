# Suppliers Module – Data Flow

This document describes the end-to-end data flow for the suppliers module,
from an inbound HTTP request through to the SQLite database and back.

---

## Request / Response flow

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Route as routes/supplier.ts
    participant Repo as SuppliersRepository
    participant DB as DatabaseConnection<br/>(better-sqlite3 wrapper)
    participant SQLite as SQLite file<br/>(data/app.db)

    Client->>Route: HTTP request<br/>(GET / POST / PUT / DELETE)
    Route->>Repo: getSuppliersRepository()<br/>returns singleton
    Route->>Repo: findAll() / findById() /<br/>create() / update() / delete()
    Repo->>DB: db.all() / db.get() / db.run()
    DB->>SQLite: prepared statement + params
    SQLite-->>DB: raw rows (snake_case, integers for booleans)
    DB-->>Repo: typed result rows
    Repo->>Repo: mapDatabaseRows() → camelCase<br/>convertBooleanFields() → true/false
    Repo-->>Route: Supplier | Supplier[] | void
    Route-->>Client: JSON response (200 / 201 / 204)
```

---

## Error propagation

```mermaid
flowchart TD
    A([SQLite throws]) --> B{Is it a\nDatabaseError?}
    B -- No --> C[handleDatabaseError\nwraps it as DatabaseError 500]
    B -- Yes --> D{error.code?}
    D -- SQLITE_CONSTRAINT UNIQUE --> E[ConflictError 409]
    D -- SQLITE_CONSTRAINT FOREIGN KEY --> F[ValidationError 400]
    D -- SQLITE_BUSY --> G[DatabaseError 503\nDATABASE_BUSY]
    D -- other DatabaseError --> H[re-throw as-is]

    C --> Z
    E --> Z
    F --> Z
    G --> Z
    H --> Z

    Z([Route catches]) --> AA{Is NotFoundError?}
    AA -- Yes --> AB[res.status 404]
    AA -- No --> AC[next error passes to\nerrorHandler middleware]
    AC --> AD[res.status error.statusCode\nJSON code + message]
```

---

## Repository method map

| HTTP endpoint | Route handler | Repository method | SQL |
|---|---|---|---|
| `GET /api/suppliers` | `router.get('/')` | `findAll()` | `SELECT * FROM suppliers ORDER BY supplier_id` |
| `GET /api/suppliers/:id` | `router.get('/:id')` | `findById(id)` | `SELECT * FROM suppliers WHERE supplier_id = ?` |
| `GET /api/suppliers/:id/status` | `router.get('/:id/status')` | `findById(id)` | `SELECT * FROM suppliers WHERE supplier_id = ?` |
| `POST /api/suppliers` | `router.post('/')` | `create(data)` | `INSERT INTO suppliers (…) VALUES (…)` |
| `PUT /api/suppliers/:id` | `router.put('/:id')` | `update(id, data)` | `UPDATE suppliers SET … WHERE supplier_id = ?` |
| `DELETE /api/suppliers/:id` | `router.delete('/:id')` | `delete(id)` | `DELETE FROM suppliers WHERE supplier_id = ?` |

---

## Connection lifecycle

```mermaid
flowchart LR
    subgraph Startup
        A[initializeDatabase] --> B[runMigrations]
        B --> C[seedDatabase]
        C --> D[closeDatabase]
    end

    subgraph "Per request (lazy)"
        E[getSuppliersRepository] --> F{suppliersRepo\nsingleton exists?}
        F -- No --> G[getDatabase\ncreates connection]
        G --> H[SQLiteHelper.connect\nPRAGMA foreign_keys ON\nPRAGMA journal_mode WAL]
        H --> I[DatabaseConnection singleton]
        F -- Yes --> I
        I --> J[SuppliersRepository]
    end

    subgraph "Test environment"
        K[getSuppliersRepository isTest=true] --> L[new connection\nto :memory: DB]
        L --> M[fresh SuppliersRepository\nper test — no shared state]
    end
```
