import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import profileRouter from './profile';
import { runMigrations } from '../db/migrate';
import { closeDatabase, getDatabase } from '../db/sqlite';
import { errorHandler } from '../utils/errors';

let app: express.Express;

describe('Profile API', () => {
  beforeEach(async () => {
    await closeDatabase();
    await getDatabase(true);
    await runMigrations(true);

    app = express();
    app.use(express.json());
    app.use('/profiles', profileRouter);
    app.use(errorHandler);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('should create a new profile', async () => {
    const newProfile = {
      username: 'test.user',
      email: 'test@octocat.com',
      fullName: 'Test User',
      role: 'viewer',
      department: 'IT',
      phone: '555-0001',
      isActive: true,
      createdAt: '2024-06-01T00:00:00.000Z',
    };

    const response = await request(app).post('/profiles').send(newProfile);

    expect(response.status).toBe(201);
    expect(response.body.username).toBe('test.user');
    expect(response.body.profileId).toBeDefined();
  });

  it('should get a profile by ID', async () => {
    const newProfile = {
      username: 'get.user',
      email: 'get@octocat.com',
      fullName: 'Get User',
      role: 'viewer',
      department: 'IT',
      phone: '555-0002',
      isActive: true,
      createdAt: '2024-06-01T00:00:00.000Z',
    };

    const createResponse = await request(app).post('/profiles').send(newProfile);
    const profileId = createResponse.body.profileId;

    const response = await request(app).get(`/profiles/${profileId}`);

    expect(response.status).toBe(200);
    expect(response.body.profileId).toBe(profileId);
    expect(response.body.username).toBe('get.user');
  });

  it('should update a profile by ID', async () => {
    const newProfile = {
      username: 'update.user',
      email: 'update@octocat.com',
      fullName: 'Update User',
      role: 'viewer',
      department: 'IT',
      phone: '555-0003',
      isActive: true,
      createdAt: '2024-06-01T00:00:00.000Z',
    };

    const createResponse = await request(app).post('/profiles').send(newProfile);
    const profileId = createResponse.body.profileId;

    const response = await request(app)
      .put(`/profiles/${profileId}`)
      .send({ fullName: 'Updated Name', role: 'manager' });

    expect(response.status).toBe(200);
    expect(response.body.fullName).toBe('Updated Name');
    expect(response.body.role).toBe('manager');
  });

  it('should delete a profile by ID', async () => {
    const newProfile = {
      username: 'delete.user',
      email: 'delete@octocat.com',
      fullName: 'Delete User',
      role: 'viewer',
      department: 'IT',
      phone: '555-0004',
      isActive: true,
      createdAt: '2024-06-01T00:00:00.000Z',
    };

    const createResponse = await request(app).post('/profiles').send(newProfile);
    const profileId = createResponse.body.profileId;

    const response = await request(app).delete(`/profiles/${profileId}`);

    expect(response.status).toBe(204);
  });

  it('should return 404 for non-existing profile', async () => {
    const response = await request(app).get('/profiles/999');

    expect(response.status).toBe(404);
  });

  it('should return 404 when updating non-existing profile', async () => {
    const response = await request(app)
      .put('/profiles/999')
      .send({ fullName: 'Ghost' });

    expect(response.status).toBe(404);
  });

  it('should return 404 when deleting non-existing profile', async () => {
    const response = await request(app).delete('/profiles/999');

    expect(response.status).toBe(404);
  });
});
