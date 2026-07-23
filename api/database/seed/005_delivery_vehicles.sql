-- Seed data for delivery_vehicles
INSERT INTO delivery_vehicles (delivery_vehicle_id, branch_id, license_plate, model, capacity_kg, status) VALUES
(1, 1, 'OCTO-1001', 'Sprinter Van', 1200.0, 'active'),
(2, 1, 'OCTO-1002', 'Box Truck', 3500.0, 'maintenance'),
(3, 2, 'OCTO-2001', 'Cargo Van', 1800.0, 'active'),
(4, 2, 'OCTO-2002', 'Electric Van', 1000.0, 'inactive');
