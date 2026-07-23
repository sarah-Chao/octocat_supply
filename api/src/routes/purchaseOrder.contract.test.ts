import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import purchaseOrderRouter from './purchaseOrder';
import { closeDatabase, getDatabase } from '../db/sqlite';
import { runMigrations } from '../db/migrate';
import { errorHandler } from '../utils/errors';

let app: express.Express;

async function seedDependencies(): Promise<void> {
  const db = await getDatabase(true);
  await db.run('INSERT INTO headquarters (headquarters_id, name) VALUES (?, ?)', [1, 'HQ 1']);
  await db.run(
    'INSERT INTO branches (branch_id, headquarters_id, name) VALUES (?, ?, ?)',
    [1, 1, 'Branch 1'],
  );
  await db.run(
    'INSERT INTO suppliers (supplier_id, name, active, verified) VALUES (?, ?, ?, ?)',
    [1, 'Supplier 1', 1, 1],
  );
  await db.run(
    `INSERT INTO products (
      product_id,
      supplier_id,
      name,
      price,
      sku,
      unit,
      discount
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [1, 1, 'Product 1', 75, 'SKU-1', 'piece', 0],
  );
}

describe('PurchaseOrder API contract (US1)', () => {
  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    await closeDatabase();
    await getDatabase(true);
    await runMigrations(true);
    await seedDependencies();

    app = express();
    app.use(express.json());
    app.use('/purchase-orders', purchaseOrderRouter);
    app.use(errorHandler);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('POST /purchase-orders returns 201 with purchaseOrder shape', async () => {
    const response = await request(app).post('/purchase-orders').send({
      branchId: 1,
      supplierId: 1,
      createdByUserId: 101,
      lineItems: [{ productId: 1, quantity: 2, expectedUnitPrice: 75 }],
    });

    expect(response.status).toBe(201);
    expect(response.body.purchaseOrderId).toBeTypeOf('number');
    expect(response.body.status).toBe('Draft');
    expect(Array.isArray(response.body.lineItems)).toBe(true);
  });

  it('POST /purchase-orders/{id}/submit returns 200 on success', async () => {
    const created = await request(app).post('/purchase-orders').send({
      branchId: 1,
      supplierId: 1,
      createdByUserId: 101,
      lineItems: [{ productId: 1, quantity: 2, expectedUnitPrice: 75 }],
    });

    const response = await request(app)
      .post(`/purchase-orders/${created.body.purchaseOrderId}/submit`)
      .send({ actorUserId: 101 });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('Submitted');
  });

  it('POST /purchase-orders/{id}/submit returns 502 when notification fails', async () => {
    const created = await request(app).post('/purchase-orders').send({
      branchId: 1,
      supplierId: 1,
      createdByUserId: 101,
      lineItems: [{ productId: 1, quantity: 2, expectedUnitPrice: 75 }],
    });

    const response = await request(app)
      .post(`/purchase-orders/${created.body.purchaseOrderId}/submit`)
      .set('x-force-notification-failure', 'true')
      .send({ actorUserId: 101 });

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe('NOTIFICATION_FAILED');
  });
});

describe('PurchaseOrder API contract (US2)', () => {
  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    await closeDatabase();
    await getDatabase(true);
    await runMigrations(true);
    await seedDependencies();

    app = express();
    app.use(express.json());
    app.use('/purchase-orders', purchaseOrderRouter);
    app.use(errorHandler);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('POST /purchase-orders/{id}/approval-decisions returns 200 for non-creator approver', async () => {
    const created = await request(app).post('/purchase-orders').send({
      branchId: 1,
      supplierId: 1,
      createdByUserId: 101,
      lineItems: [{ productId: 1, quantity: 300, expectedUnitPrice: 75 }],
    });

    await request(app)
      .post(`/purchase-orders/${created.body.purchaseOrderId}/submit`)
      .send({ actorUserId: 101 });

    const response = await request(app)
      .post(`/purchase-orders/${created.body.purchaseOrderId}/approval-decisions`)
      .send({ approverUserId: 202, decision: 'Approved' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('Approved');
  });

  it('POST /purchase-orders/{id}/approval-decisions returns 403 for creator self-approval', async () => {
    const created = await request(app).post('/purchase-orders').send({
      branchId: 1,
      supplierId: 1,
      createdByUserId: 101,
      lineItems: [{ productId: 1, quantity: 300, expectedUnitPrice: 75 }],
    });

    await request(app)
      .post(`/purchase-orders/${created.body.purchaseOrderId}/submit`)
      .send({ actorUserId: 101 });

    const response = await request(app)
      .post(`/purchase-orders/${created.body.purchaseOrderId}/approval-decisions`)
      .send({ approverUserId: 101, decision: 'Approved' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});
