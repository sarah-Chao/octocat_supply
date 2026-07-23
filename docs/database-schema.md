# Database Schema – Entity Relationship Diagram

Generated from migration files:
- `database/migrations/001_init.sql` — core schema
- `database/migrations/002_add_supplier_status_fields.sql` — adds `active` / `verified` to `suppliers`

---

## ERD

```mermaid
erDiagram
    suppliers {
        INTEGER supplier_id PK
        TEXT    name        "NOT NULL"
        TEXT    description
        TEXT    contact_person
        TEXT    email
        TEXT    phone
        INTEGER active      "NOT NULL DEFAULT 1"
        INTEGER verified    "NOT NULL DEFAULT 0"
    }

    headquarters {
        INTEGER headquarters_id PK
        TEXT    name            "NOT NULL"
        TEXT    description
        TEXT    address
        TEXT    contact_person
        TEXT    email
        TEXT    phone
    }

    branches {
        INTEGER branch_id        PK
        INTEGER headquarters_id  FK "NOT NULL"
        TEXT    name             "NOT NULL"
        TEXT    description
        TEXT    address
        TEXT    contact_person
        TEXT    email
        TEXT    phone
    }

    products {
        INTEGER product_id   PK
        INTEGER supplier_id  FK "NOT NULL"
        TEXT    name         "NOT NULL"
        TEXT    description
        REAL    price        "NOT NULL"
        TEXT    sku          "NOT NULL"
        TEXT    unit         "NOT NULL"
        TEXT    img_name
        REAL    discount     "DEFAULT 0.0"
    }

    orders {
        INTEGER order_id    PK
        INTEGER branch_id   FK "NOT NULL"
        TEXT    order_date  "NOT NULL"
        TEXT    name        "NOT NULL"
        TEXT    description
        TEXT    status      "NOT NULL DEFAULT 'pending'"
    }

    order_details {
        INTEGER order_detail_id PK
        INTEGER order_id        FK "NOT NULL"
        INTEGER product_id      FK "NOT NULL"
        INTEGER quantity        "NOT NULL"
        REAL    unit_price      "NOT NULL"
        TEXT    notes
    }

    deliveries {
        INTEGER delivery_id   PK
        INTEGER supplier_id   FK "NOT NULL"
        TEXT    delivery_date "NOT NULL"
        TEXT    name          "NOT NULL"
        TEXT    description
        TEXT    status        "NOT NULL DEFAULT 'pending'"
    }

    order_detail_deliveries {
        INTEGER order_detail_delivery_id PK
        INTEGER order_detail_id          FK "NOT NULL"
        INTEGER delivery_id              FK "NOT NULL"
        INTEGER quantity                 "NOT NULL"
        TEXT    notes
    }

    %% headquarters → branches  (one-to-many, CASCADE DELETE)
    headquarters ||--o{ branches : "has"

    %% suppliers → products  (one-to-many, CASCADE DELETE)
    suppliers ||--o{ products : "supplies"

    %% branches → orders  (one-to-many, CASCADE DELETE)
    branches ||--o{ orders : "places"

    %% orders → order_details  (one-to-many, CASCADE DELETE)
    orders ||--o{ order_details : "contains"

    %% products → order_details  (one-to-many, CASCADE DELETE)
    products ||--o{ order_details : "referenced in"

    %% suppliers → deliveries  (one-to-many, CASCADE DELETE)
    suppliers ||--o{ deliveries : "fulfils"

    %% order_details → order_detail_deliveries  (one-to-many, CASCADE DELETE)
    order_details ||--o{ order_detail_deliveries : "fulfilled by"

    %% deliveries → order_detail_deliveries  (one-to-many, CASCADE DELETE)
    deliveries ||--o{ order_detail_deliveries : "covers"
```

---

## Relationship summary

| Parent table | Child table | FK column | Cardinality | On delete |
|---|---|---|---|---|
| `headquarters` | `branches` | `branches.headquarters_id` | 1 : N | CASCADE |
| `suppliers` | `products` | `products.supplier_id` | 1 : N | CASCADE |
| `branches` | `orders` | `orders.branch_id` | 1 : N | CASCADE |
| `orders` | `order_details` | `order_details.order_id` | 1 : N | CASCADE |
| `products` | `order_details` | `order_details.product_id` | 1 : N | CASCADE |
| `suppliers` | `deliveries` | `deliveries.supplier_id` | 1 : N | CASCADE |
| `order_details` | `order_detail_deliveries` | `order_detail_deliveries.order_detail_id` | 1 : N | CASCADE |
| `deliveries` | `order_detail_deliveries` | `order_detail_deliveries.delivery_id` | 1 : N | CASCADE |

> **Note:** `order_detail_deliveries` is a junction table that links `order_details` and `deliveries`,
> representing the many-to-many relationship between order line items and delivery shipments.

---

## Index inventory

| Index name | Table | Column(s) |
|---|---|---|
| `idx_branches_headquarters_id` | `branches` | `headquarters_id` |
| `idx_products_supplier_id` | `products` | `supplier_id` |
| `idx_products_sku` | `products` | `sku` |
| `idx_orders_branch_id` | `orders` | `branch_id` |
| `idx_orders_status` | `orders` | `status` |
| `idx_order_details_order_id` | `order_details` | `order_id` |
| `idx_order_details_product_id` | `order_details` | `product_id` |
| `idx_deliveries_supplier_id` | `deliveries` | `supplier_id` |
| `idx_deliveries_status` | `deliveries` | `status` |
| `idx_order_detail_deliveries_order_detail_id` | `order_detail_deliveries` | `order_detail_id` |
| `idx_order_detail_deliveries_delivery_id` | `order_detail_deliveries` | `delivery_id` |
