-- Migration 003: Create delivery_vehicles table

CREATE TABLE delivery_vehicles (
    delivery_vehicle_id INTEGER PRIMARY KEY,
    branch_id INTEGER NOT NULL,
    license_plate TEXT NOT NULL UNIQUE,
    model TEXT NOT NULL,
    capacity_kg REAL NOT NULL CHECK (capacity_kg >= 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
    FOREIGN KEY (branch_id) REFERENCES branches(branch_id) ON DELETE CASCADE
);

CREATE INDEX idx_delivery_vehicles_branch_id ON delivery_vehicles(branch_id);
CREATE INDEX idx_delivery_vehicles_status ON delivery_vehicles(status);
