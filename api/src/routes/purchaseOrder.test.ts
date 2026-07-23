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

describe('PurchaseOrder API US1', () => {
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

  it('creates a draft purchase order', async () => {
    const response = await request(app).post('/purchase-orders').send({
      branchId: 1,
      supplierId: 1,
      createdByUserId: 100,
      lineItems: [{ productId: 1, quantity: 2, expectedUnitPrice: 75 }],
    });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('Draft');
    expect(response.body.totalAmount).toBe(150);
    expect(response.body.lineItems).toHaveLength(1);
  });

  it('rejects invalid draft payload', async () => {
    const response = await request(app).post('/purchase-orders').send({
      branchId: 1,
      supplierId: 1,
      createdByUserId: 100,
      lineItems: [],
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('submits a draft purchase order', async () => {
    const createResponse = await request(app).post('/purchase-orders').send({
      branchId: 1,
      supplierId: 1,
      createdByUserId: 100,
      lineItems: [{ productId: 1, quantity: 1, expectedUnitPrice: 75 }],
    });

    const submitResponse = await request(app)
      .post(`/purchase-orders/${createResponse.body.purchaseOrderId}/submit`)
      .send({ actorUserId: 100 });

    expect(submitResponse.status).toBe(200);
    expect(submitResponse.body.status).toBe('Submitted');
    expect(submitResponse.body.notificationEvents).toHaveLength(1);
  });

  it('rolls back submit when notification dispatch fails', async () => {
    const createResponse = await request(app).post('/purchase-orders').send({
      branchId: 1,
      supplierId: 1,
      createdByUserId: 100,
      lineItems: [{ productId: 1, quantity: 1, expectedUnitPrice: 75 }],
    });

    const submitResponse = await request(app)
      .post(`/purchase-orders/${createResponse.body.purchaseOrderId}/submit`)
      .set('x-force-notification-failure', 'true')
      .send({ actorUserId: 100 });

    expect(submitResponse.status).toBe(502);

    const getResponse = await request(app).get(
      `/purchase-orders/${createResponse.body.purchaseOrderId}`,
    );

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.status).toBe('Draft');
    expect(getResponse.body.notificationEvents).toHaveLength(0);
  });
});

describe('PurchaseOrder API US2', () => {
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

  it('rejects creator self-approval for high-value submitted purchase order', async () => {
    const createResponse = await request(app).post('/purchase-orders').send({
      branchId: 1,
      supplierId: 1,
      createdByUserId: 100,
      lineItems: [{ productId: 1, quantity: 300, expectedUnitPrice: 75 }],
    });

    await request(app)
      .post(`/purchase-orders/${createResponse.body.purchaseOrderId}/submit`)
      .send({ actorUserId: 100 });

    const response = await request(app)
      .post(`/purchase-orders/${createResponse.body.purchaseOrderId}/approval-decisions`)
      .send({ approverUserId: 100, decision: 'Approved' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('approves high-value submitted purchase order by non-creator approver', async () => {
    const createResponse = await request(app).post('/purchase-orders').send({
      branchId: 1,
      supplierId: 1,
      createdByUserId: 100,
      lineItems: [{ productId: 1, quantity: 300, expectedUnitPrice: 75 }],
    });

    await request(app)
      .post(`/purchase-orders/${createResponse.body.purchaseOrderId}/submit`)
      .send({ actorUserId: 100 });

    const response = await request(app)
      .post(`/purchase-orders/${createResponse.body.purchaseOrderId}/approval-decisions`)
      .send({ approverUserId: 200, decision: 'Approved' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('Approved');
    expect(response.body.approvalDecision.decision).toBe('Approved');
  });

  it('rejects high-value submitted purchase order and transitions to Cancelled', async () => {
    const createResponse = await request(app).post('/purchase-orders').send({
      branchId: 1,
      supplierId: 1,
      createdByUserId: 100,
      lineItems: [{ productId: 1, quantity: 300, expectedUnitPrice: 75 }],
    });

    await request(app)
      .post(`/purchase-orders/${createResponse.body.purchaseOrderId}/submit`)
      .send({ actorUserId: 100 });

    const response = await request(app)
      .post(`/purchase-orders/${createResponse.body.purchaseOrderId}/approval-decisions`)
      .send({ approverUserId: 201, decision: 'Rejected', reason: 'Budget denied' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('Cancelled');
    expect(response.body.approvalDecision.decision).toBe('Rejected');
  });

  it('keeps approvalRequired false at threshold total 10000', async () => {
    const createResponse = await request(app).post('/purchase-orders').send({
      branchId: 1,
      supplierId: 1,
      createdByUserId: 100,
      lineItems: [{ productId: 1, quantity: 200, expectedUnitPrice: 50 }],
    });

    const submitResponse = await request(app)
      .post(`/purchase-orders/${createResponse.body.purchaseOrderId}/submit`)
      .send({ actorUserId: 100 });

    expect(submitResponse.status).toBe(200);
    expect(submitResponse.body.totalAmount).toBe(10000);
    expect(submitResponse.body.approvalRequired).toBe(false);
  });
});
