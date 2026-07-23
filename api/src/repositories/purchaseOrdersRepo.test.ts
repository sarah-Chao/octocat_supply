import { beforeEach, describe, expect, it } from 'vitest';
import {
  createFailingNotificationDispatcher,
  PurchaseOrdersRepository,
} from './purchaseOrdersRepo';
import { closeDatabase, getDatabase } from '../db/sqlite';
import { runMigrations } from '../db/migrate';
import { DatabaseError } from '../utils/errors';

async function seedDependencies(): Promise<void> {
  const db = await getDatabase(true);
  await db.run(
    'INSERT INTO headquarters (headquarters_id, name) VALUES (?, ?)',
    [1, 'HQ 1'],
  );
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
    [1, 1, 'Product 1', 50, 'SKU-1', 'piece', 0],
  );
}

describe('PurchaseOrdersRepository integration', () => {
  let repo: PurchaseOrdersRepository;

  beforeEach(async () => {
    await closeDatabase();
    await getDatabase(true);
    await runMigrations(true);
    await seedDependencies();
    const db = await getDatabase(true);
    repo = new PurchaseOrdersRepository(db);
  });

  it('creates draft purchase order with line items and initial transition', async () => {
    const created = await repo.createDraft({
      branchId: 1,
      supplierId: 1,
      createdByUserId: 100,
      lineItems: [{ productId: 1, quantity: 2, expectedUnitPrice: 50 }],
    });

    expect(created.purchaseOrderId).toBeDefined();
    expect(created.status).toBe('Draft');
    expect(created.totalAmount).toBe(100);
    expect(created.lineItems).toHaveLength(1);
    expect(created.transitions).toHaveLength(1);
    expect(created.transitions[0].toStatus).toBe('Draft');
  });

  it('submits draft and records notification + transition', async () => {
    const created = await repo.createDraft({
      branchId: 1,
      supplierId: 1,
      createdByUserId: 100,
      lineItems: [{ productId: 1, quantity: 3, expectedUnitPrice: 50 }],
    });

    const submitted = await repo.submitDraft(created.purchaseOrderId, 100);

    expect(submitted.status).toBe('Submitted');
    expect(submitted.submittedAt).toBeTruthy();
    expect(submitted.notificationEvents).toHaveLength(1);
    expect(submitted.notificationEvents[0].dispatchStatus).toBe('Succeeded');
    expect(submitted.transitions.map((x) => x.toStatus)).toEqual(['Draft', 'Submitted']);
  });

  it('is idempotent for repeated submit and does not duplicate notifications', async () => {
    const created = await repo.createDraft({
      branchId: 1,
      supplierId: 1,
      createdByUserId: 100,
      lineItems: [{ productId: 1, quantity: 1, expectedUnitPrice: 50 }],
    });

    await repo.submitDraft(created.purchaseOrderId, 100);
    const secondSubmit = await repo.submitDraft(created.purchaseOrderId, 100);

    expect(secondSubmit.status).toBe('Submitted');
    expect(secondSubmit.notificationEvents).toHaveLength(1);
  });

  it('rolls back submit when notification dispatch fails', async () => {
    const created = await repo.createDraft({
      branchId: 1,
      supplierId: 1,
      createdByUserId: 100,
      lineItems: [{ productId: 1, quantity: 5, expectedUnitPrice: 50 }],
    });

    const db = await getDatabase(true);
    const failingRepo = new PurchaseOrdersRepository(db, createFailingNotificationDispatcher());

    await expect(failingRepo.submitDraft(created.purchaseOrderId, 100)).rejects.toThrow(DatabaseError);

    const refreshed = await repo.findById(created.purchaseOrderId);
    expect(refreshed?.status).toBe('Draft');
    expect(refreshed?.notificationEvents).toHaveLength(0);
    expect(refreshed?.transitions).toHaveLength(1);
  });
});
