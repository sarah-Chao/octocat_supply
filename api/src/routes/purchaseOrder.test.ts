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

describe('PurchaseOrder API US3', () => {
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

  it('returns lifecycle history with notification metadata after submission', async () => {
    const created = await request(app).post('/purchase-orders').send({
      branchId: 1,
      supplierId: 1,
      createdByUserId: 100,
      lineItems: [{ productId: 1, quantity: 2, expectedUnitPrice: 75 }],
    });

    await request(app)
      .post(`/purchase-orders/${created.body.purchaseOrderId}/submit`)
      .send({ actorUserId: 100 });

    const response = await request(app).get(`/purchase-orders/${created.body.purchaseOrderId}`);

    expect(response.status).toBe(200);
    expect(response.body.transitions.map((x: { toStatus: string }) => x.toStatus)).toEqual([
      'Draft',
      'Submitted',
    ]);
    expect(response.body.notificationEvents).toHaveLength(1);
    expect(response.body.notificationEvents[0].eventType).toBe('PO_SUBMITTED');
    expect(response.body.notificationEvents[0].dispatchStatus).toBe('Succeeded');
  });

  it('fulfills approved purchase order and records transition', async () => {
    const created = await request(app).post('/purchase-orders').send({
      branchId: 1,
      supplierId: 1,
      createdByUserId: 100,
      lineItems: [{ productId: 1, quantity: 300, expectedUnitPrice: 75 }],
    });

    await request(app)
      .post(`/purchase-orders/${created.body.purchaseOrderId}/submit`)
      .send({ actorUserId: 100 });

    await request(app)
      .post(`/purchase-orders/${created.body.purchaseOrderId}/approval-decisions`)
      .send({ approverUserId: 200, decision: 'Approved' });

    const fulfillResponse = await request(app)
      .post(`/purchase-orders/${created.body.purchaseOrderId}/fulfill`)
      .send({ actorUserId: 300 });

    expect(fulfillResponse.status).toBe(200);
    expect(fulfillResponse.body.status).toBe('Fulfilled');
    expect(
      fulfillResponse.body.transitions[fulfillResponse.body.transitions.length - 1].toStatus,
    ).toBe('Fulfilled');
  });

  it('cancels submitted purchase order and records transition', async () => {
    const created = await request(app).post('/purchase-orders').send({
      branchId: 1,
      supplierId: 1,
      createdByUserId: 100,
      lineItems: [{ productId: 1, quantity: 2, expectedUnitPrice: 75 }],
    });

    await request(app)
      .post(`/purchase-orders/${created.body.purchaseOrderId}/submit`)
      .send({ actorUserId: 100 });

    const cancelResponse = await request(app)
      .post(`/purchase-orders/${created.body.purchaseOrderId}/cancel`)
      .send({ actorUserId: 400, reason: 'Buyer requested cancellation' });

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.status).toBe('Cancelled');
    expect(
      cancelResponse.body.transitions[cancelResponse.body.transitions.length - 1].toStatus,
    ).toBe('Cancelled');
  });

  it('blocks state changes from terminal statuses', async () => {
    const created = await request(app).post('/purchase-orders').send({
      branchId: 1,
      supplierId: 1,
      createdByUserId: 100,
      lineItems: [{ productId: 1, quantity: 300, expectedUnitPrice: 75 }],
    });

    await request(app)
      .post(`/purchase-orders/${created.body.purchaseOrderId}/submit`)
      .send({ actorUserId: 100 });
    await request(app)
      .post(`/purchase-orders/${created.body.purchaseOrderId}/approval-decisions`)
      .send({ approverUserId: 200, decision: 'Approved' });
    await request(app)
      .post(`/purchase-orders/${created.body.purchaseOrderId}/fulfill`)
      .send({ actorUserId: 300 });

    const cancelAfterFulfilled = await request(app)
      .post(`/purchase-orders/${created.body.purchaseOrderId}/cancel`)
      .send({ actorUserId: 400, reason: 'Too late' });

    expect(cancelAfterFulfilled.status).toBe(409);
    expect(cancelAfterFulfilled.body.error.code).toBe('CONFLICT');
  });
});
