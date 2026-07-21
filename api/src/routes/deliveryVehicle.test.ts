import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import deliveryVehicleRouter from './deliveryVehicle';
import { runMigrations } from '../db/migrate';
import { closeDatabase, getDatabase } from '../db/sqlite';
import { errorHandler } from '../utils/errors';

let app: express.Express;

describe('DeliveryVehicle API', () => {
  beforeEach(async () => {
    await closeDatabase();
    await getDatabase(true);
    await runMigrations(true);

    const db = await getDatabase();
    await db.run('INSERT INTO headquarters (headquarters_id, name) VALUES (?, ?)', [1, 'HQ One']);
    await db.run('INSERT INTO branches (branch_id, headquarters_id, name) VALUES (?, ?, ?)', [
      1,
      1,
      'Branch One',
    ]);

    app = express();
    app.use(express.json());
    app.use('/delivery-vehicles', deliveryVehicleRouter);
    app.use(errorHandler);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('should create a new delivery vehicle', async () => {
    const newVehicle = {
      branchId: 1,
      licensePlate: 'OCTO-4001',
      model: 'Panel Van',
      capacityKg: 1100,
      status: 'active',
    };

    const response = await request(app).post('/delivery-vehicles').send(newVehicle);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject(newVehicle);
    expect(response.body.deliveryVehicleId).toBeDefined();
  });

  it('should get all delivery vehicles', async () => {
    await request(app).post('/delivery-vehicles').send({
      branchId: 1,
      licensePlate: 'OCTO-4002',
      model: 'Panel Van',
      capacityKg: 1100,
      status: 'active',
    });

    const response = await request(app).get('/delivery-vehicles');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  it('should get a delivery vehicle by ID', async () => {
    const createResponse = await request(app).post('/delivery-vehicles').send({
      branchId: 1,
      licensePlate: 'OCTO-4003',
      model: 'Cargo Van',
      capacityKg: 1700,
      status: 'active',
    });

    const vehicleId = createResponse.body.deliveryVehicleId;
    const response = await request(app).get(`/delivery-vehicles/${vehicleId}`);

    expect(response.status).toBe(200);
    expect(response.body.deliveryVehicleId).toBe(vehicleId);
  });

  it('should update a delivery vehicle by ID', async () => {
    const createResponse = await request(app).post('/delivery-vehicles').send({
      branchId: 1,
      licensePlate: 'OCTO-4004',
      model: 'Cargo Van',
      capacityKg: 1700,
      status: 'active',
    });

    const vehicleId = createResponse.body.deliveryVehicleId;
    const response = await request(app)
      .put(`/delivery-vehicles/${vehicleId}`)
      .send({ status: 'maintenance' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('maintenance');
  });

  it('should delete a delivery vehicle by ID', async () => {
    const createResponse = await request(app).post('/delivery-vehicles').send({
      branchId: 1,
      licensePlate: 'OCTO-4005',
      model: 'Cargo Van',
      capacityKg: 1700,
      status: 'active',
    });

    const vehicleId = createResponse.body.deliveryVehicleId;
    const response = await request(app).delete(`/delivery-vehicles/${vehicleId}`);

    expect(response.status).toBe(204);
  });

  it('should return 404 for non-existing delivery vehicle', async () => {
    const response = await request(app).get('/delivery-vehicles/999');

    expect(response.status).toBe(404);
  });
});
