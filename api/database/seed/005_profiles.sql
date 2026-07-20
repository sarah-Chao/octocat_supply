-- Seed data for profiles
-- Provides realistic user profiles for development and demo purposes

INSERT INTO profiles (profile_id, username, email, full_name, role, department, phone, is_active, created_at) VALUES
(1, 'felix.admin', 'felix.admin@octocat.com', 'Felix Whiskerton', 'admin', 'Operations', '555-1001', 1, '2024-01-15T10:00:00.000Z'),
(2, 'tabitha.manager', 'tabitha.manager@octocat.com', 'Tabitha Pawson', 'manager', 'Supply Chain', '555-1002', 1, '2024-01-16T11:30:00.000Z'),
(3, 'nina.viewer', 'nina.viewer@octocat.com', 'Nina Nibbles', 'viewer', 'Finance', '555-1003', 1, '2024-01-17T09:15:00.000Z'),
(4, 'oscar.inactive', 'oscar.inactive@octocat.com', 'Oscar Claws', 'viewer', 'Logistics', '555-1004', 0, '2024-01-18T14:45:00.000Z');
