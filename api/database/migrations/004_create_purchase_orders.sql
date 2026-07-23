-- Migration 004: Create purchase order lifecycle tables

CREATE TABLE purchase_orders (
    purchase_order_id INTEGER PRIMARY KEY,
    branch_id INTEGER NOT NULL,
    supplier_id INTEGER NOT NULL,
    created_by_user_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Fulfilled', 'Cancelled')),
    approval_required INTEGER NOT NULL DEFAULT 0 CHECK (approval_required IN (0, 1)),
    currency_code TEXT NOT NULL DEFAULT 'USD',
    total_amount REAL NOT NULL CHECK (total_amount >= 0),
    submitted_at TEXT,
    approved_at TEXT,
    fulfilled_at TEXT,
    cancelled_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(branch_id) ON DELETE RESTRICT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE RESTRICT
);

CREATE TABLE purchase_order_line_items (
    purchase_order_line_item_id INTEGER PRIMARY KEY,
    purchase_order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    expected_unit_price REAL NOT NULL CHECK (expected_unit_price > 0),
    line_total REAL NOT NULL CHECK (line_total >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(purchase_order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT
);

CREATE TABLE purchase_order_approval_decisions (
    purchase_order_approval_decision_id INTEGER PRIMARY KEY,
    purchase_order_id INTEGER NOT NULL UNIQUE,
    approver_user_id INTEGER NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('Approved', 'Rejected')),
    reason TEXT,
    decided_at TEXT NOT NULL,
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(purchase_order_id) ON DELETE CASCADE
);

CREATE TABLE purchase_order_status_transitions (
    purchase_order_status_transition_id INTEGER PRIMARY KEY,
    purchase_order_id INTEGER NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL CHECK (to_status IN ('Draft', 'Submitted', 'Approved', 'Fulfilled', 'Cancelled')),
    changed_by_user_id INTEGER NOT NULL,
    changed_at TEXT NOT NULL,
    reason TEXT,
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(purchase_order_id) ON DELETE CASCADE
);

CREATE TABLE supplier_notification_events (
    supplier_notification_event_id INTEGER PRIMARY KEY,
    purchase_order_id INTEGER NOT NULL,
    supplier_id INTEGER NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('PO_SUBMITTED')),
    dispatch_status TEXT NOT NULL CHECK (dispatch_status IN ('Succeeded', 'Failed')),
    dispatched_at TEXT NOT NULL,
    failure_reason TEXT,
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(purchase_order_id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE RESTRICT
);

CREATE INDEX idx_purchase_orders_branch_id ON purchase_orders(branch_id);
CREATE INDEX idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_approval_required ON purchase_orders(approval_required);

CREATE INDEX idx_purchase_order_line_items_purchase_order_id ON purchase_order_line_items(purchase_order_id);
CREATE INDEX idx_purchase_order_line_items_product_id ON purchase_order_line_items(product_id);

CREATE INDEX idx_purchase_order_status_transitions_purchase_order_id ON purchase_order_status_transitions(purchase_order_id);
CREATE INDEX idx_supplier_notification_events_purchase_order_id ON supplier_notification_events(purchase_order_id);
