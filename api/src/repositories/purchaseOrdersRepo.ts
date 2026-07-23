import { getDatabase, DatabaseConnection } from '../db/sqlite';
import {
  ConflictError,
  DatabaseError,
  NotFoundError,
  ValidationError,
  handleDatabaseError,
} from '../utils/errors';
import {
  mapDatabaseRows,
  objectToCamelCase,
  type DatabaseRow,
} from '../utils/sql';
import type {
  NewPurchaseOrder,
  PurchaseOrder,
  PurchaseOrderStatus,
  PurchaseOrderStatusTransition,
} from '../models/purchaseOrder';
import type { PurchaseOrderLineItem } from '../models/purchaseOrderLineItem';
import type { SupplierNotificationEvent } from '../models/supplierNotificationEvent';
import type { PurchaseOrderApprovalDecision } from '../models/purchaseOrderApprovalDecision';

type DispatchContext = {
  purchaseOrderId: number;
  supplierId: number;
};

type SubmissionOptions = {
  forceNotificationFailure?: boolean;
};

type ApprovalDecisionInput = {
  approverUserId: number;
  decision: 'Approved' | 'Rejected';
  reason?: string;
};

type NotificationDispatcher = (
  context: DispatchContext,
  options?: SubmissionOptions,
) => boolean;

function defaultNotificationDispatcher(_context: DispatchContext, options?: SubmissionOptions): boolean {
  return !options?.forceNotificationFailure;
}

type PurchaseOrderRow = Omit<PurchaseOrder, 'approvalRequired' | 'lineItems' | 'transitions' | 'notificationEvents' | 'approvalDecision'> & {
  approvalRequired: number;
};

export class PurchaseOrdersRepository {
  private db: DatabaseConnection;

  private notificationDispatcher: NotificationDispatcher;

  constructor(db: DatabaseConnection, notificationDispatcher: NotificationDispatcher = defaultNotificationDispatcher) {
    this.db = db;
    this.notificationDispatcher = notificationDispatcher;
  }

  private nowIso(): string {
    return new Date().toISOString();
  }

  private validateLineItems(lineItems: NewPurchaseOrder['lineItems']): void {
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      throw new ValidationError('At least one line item is required');
    }

    for (const item of lineItems) {
      if (!Number.isInteger(item.productId) || item.productId <= 0) {
        throw new ValidationError('Line item productId must be a positive integer');
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new ValidationError('Line item quantity must be a positive integer');
      }
      if (typeof item.expectedUnitPrice !== 'number' || item.expectedUnitPrice <= 0) {
        throw new ValidationError('Line item expectedUnitPrice must be a positive number');
      }
    }
  }

  private calculateTotal(lineItems: NewPurchaseOrder['lineItems']): number {
    return Number(
      lineItems
        .reduce((sum, item) => sum + item.quantity * item.expectedUnitPrice, 0)
        .toFixed(2),
    );
  }

  private ensureRecordExists(table: 'branches' | 'suppliers', idColumn: string, id: number): void {
    const row = this.db.db
      .prepare(`SELECT COUNT(*) as count FROM ${table} WHERE ${idColumn} = ?`)
      .get(id) as { count?: number };

    if (!row?.count) {
      throw new ValidationError(`${table.slice(0, -1)} ${id} does not exist`);
    }
  }

  private ensureProductsExist(productIds: number[]): void {
    const placeholders = productIds.map(() => '?').join(', ');
    const row = this.db.db
      .prepare(`SELECT COUNT(*) as count FROM products WHERE product_id IN (${placeholders})`)
      .get(...productIds) as { count?: number };

    if ((row?.count || 0) !== productIds.length) {
      throw new ValidationError('One or more products do not exist');
    }
  }

  async findAll(): Promise<PurchaseOrder[]> {
    try {
      const rows = await this.db.all<DatabaseRow>(
        'SELECT * FROM purchase_orders ORDER BY purchase_order_id',
      );

      const orders = mapDatabaseRows<PurchaseOrderRow>(rows);
      const detailed = await Promise.all(
        orders.map((order) => this.findById(order.purchaseOrderId)),
      );

      return detailed.filter((item): item is PurchaseOrder => item !== null);
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  async findById(id: number): Promise<PurchaseOrder | null> {
    try {
      const row = await this.db.get<DatabaseRow>(
        'SELECT * FROM purchase_orders WHERE purchase_order_id = ?',
        [id],
      );

      if (!row) {
        return null;
      }

      const order = objectToCamelCase<PurchaseOrderRow>(row);
      const [lineItems, transitions, notificationEvents, approvalDecision] = await Promise.all([
        this.getLineItems(id),
        this.getTransitions(id),
        this.getNotificationEvents(id),
        this.getApprovalDecision(id),
      ]);

      return {
        ...order,
        approvalRequired: Boolean(order.approvalRequired),
        lineItems,
        transitions,
        notificationEvents,
        approvalDecision,
      };
    } catch (error) {
      handleDatabaseError(error);
    }
  }

  private async getLineItems(purchaseOrderId: number): Promise<PurchaseOrderLineItem[]> {
    const rows = await this.db.all<DatabaseRow>(
      'SELECT * FROM purchase_order_line_items WHERE purchase_order_id = ? ORDER BY purchase_order_line_item_id',
      [purchaseOrderId],
    );

    return mapDatabaseRows<PurchaseOrderLineItem>(rows);
  }

  private async getTransitions(purchaseOrderId: number): Promise<PurchaseOrderStatusTransition[]> {
    const rows = await this.db.all<DatabaseRow>(
      'SELECT * FROM purchase_order_status_transitions WHERE purchase_order_id = ? ORDER BY purchase_order_status_transition_id',
      [purchaseOrderId],
    );

    return mapDatabaseRows<PurchaseOrderStatusTransition>(rows);
  }

  private async getNotificationEvents(purchaseOrderId: number): Promise<SupplierNotificationEvent[]> {
    const rows = await this.db.all<DatabaseRow>(
      'SELECT * FROM supplier_notification_events WHERE purchase_order_id = ? ORDER BY supplier_notification_event_id',
      [purchaseOrderId],
    );

    return mapDatabaseRows<SupplierNotificationEvent>(rows);
  }

  private async getApprovalDecision(purchaseOrderId: number): Promise<PurchaseOrderApprovalDecision | null> {
    const row = await this.db.get<DatabaseRow>(
      'SELECT * FROM purchase_order_approval_decisions WHERE purchase_order_id = ?',
      [purchaseOrderId],
    );

    return row ? objectToCamelCase<PurchaseOrderApprovalDecision>(row) : null;
  }

  async createDraft(order: NewPurchaseOrder): Promise<PurchaseOrder> {
    try {
      if (!Number.isInteger(order.branchId) || order.branchId <= 0) {
        throw new ValidationError('branchId must be a positive integer');
      }
      if (!Number.isInteger(order.supplierId) || order.supplierId <= 0) {
        throw new ValidationError('supplierId must be a positive integer');
      }
      if (!Number.isInteger(order.createdByUserId) || order.createdByUserId <= 0) {
        throw new ValidationError('createdByUserId must be a positive integer');
      }

      this.validateLineItems(order.lineItems);
      this.ensureRecordExists('branches', 'branch_id', order.branchId);
      this.ensureRecordExists('suppliers', 'supplier_id', order.supplierId);
      this.ensureProductsExist(order.lineItems.map((item) => item.productId));

      const totalAmount = this.calculateTotal(order.lineItems);
      const now = this.nowIso();

      const tx = this.db.db.transaction(() => {
        const insertOrder = this.db.db.prepare(
          `INSERT INTO purchase_orders (
            branch_id,
            supplier_id,
            created_by_user_id,
            status,
            approval_required,
            currency_code,
            total_amount,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, 'Draft', 0, ?, ?, ?, ?)`,
        );

        const result = insertOrder.run(
          order.branchId,
          order.supplierId,
          order.createdByUserId,
          order.currencyCode || 'USD',
          totalAmount,
          now,
          now,
        );

        const purchaseOrderId = Number(result.lastInsertRowid);

        const insertLineItem = this.db.db.prepare(
          `INSERT INTO purchase_order_line_items (
            purchase_order_id,
            product_id,
            quantity,
            expected_unit_price,
            line_total,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        );

        for (const lineItem of order.lineItems) {
          insertLineItem.run(
            purchaseOrderId,
            lineItem.productId,
            lineItem.quantity,
            lineItem.expectedUnitPrice,
            Number((lineItem.quantity * lineItem.expectedUnitPrice).toFixed(2)),
            now,
            now,
          );
        }

        this.db.db
          .prepare(
            `INSERT INTO purchase_order_status_transitions (
              purchase_order_id,
              from_status,
              to_status,
              changed_by_user_id,
              changed_at,
              reason
            ) VALUES (?, NULL, 'Draft', ?, ?, ?)`,
          )
          .run(purchaseOrderId, order.createdByUserId, now, 'Draft created');

        return purchaseOrderId;
      });

      const purchaseOrderId = tx();
      const created = await this.findById(purchaseOrderId);

      if (!created) {
        throw new DatabaseError('Failed to retrieve created purchase order');
      }

      return created;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }
      handleDatabaseError(error);
    }
  }

  async submitDraft(
    purchaseOrderId: number,
    actorUserId: number,
    options?: SubmissionOptions,
  ): Promise<PurchaseOrder> {
    try {
      if (!Number.isInteger(actorUserId) || actorUserId <= 0) {
        throw new ValidationError('actorUserId must be a positive integer');
      }

      const tx = this.db.db.transaction(() => {
        const orderRow = this.db.db
          .prepare('SELECT * FROM purchase_orders WHERE purchase_order_id = ?')
          .get(purchaseOrderId) as DatabaseRow | undefined;

        if (!orderRow) {
          throw new NotFoundError('PurchaseOrder', purchaseOrderId);
        }

        const order = objectToCamelCase<PurchaseOrderRow>(orderRow);

        if (order.status === 'Submitted') {
          return 'already-submitted';
        }

        if (order.status !== 'Draft') {
          throw new ConflictError(`Purchase order ${purchaseOrderId} cannot be submitted from status ${order.status}`);
        }

        const lineRows = this.db.db
          .prepare('SELECT * FROM purchase_order_line_items WHERE purchase_order_id = ?')
          .all(purchaseOrderId) as DatabaseRow[];

        const lineItems = mapDatabaseRows<PurchaseOrderLineItem>(lineRows);
        this.validateLineItems(lineItems);

        const totalAmount = this.calculateTotal(
          lineItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            expectedUnitPrice: item.expectedUnitPrice,
          })),
        );

        const dispatchSucceeded = this.notificationDispatcher(
          {
            purchaseOrderId,
            supplierId: order.supplierId,
          },
          options,
        );

        if (!dispatchSucceeded) {
          throw new DatabaseError(
            'Supplier notification dispatch failed; submission rolled back',
            'NOTIFICATION_FAILED',
            502,
          );
        }

        const now = this.nowIso();
        const approvalRequired = totalAmount > 10000 ? 1 : 0;

        this.db.db
          .prepare(
            `INSERT INTO supplier_notification_events (
              purchase_order_id,
              supplier_id,
              event_type,
              dispatch_status,
              dispatched_at,
              failure_reason
            ) VALUES (?, ?, 'PO_SUBMITTED', 'Succeeded', ?, NULL)`,
          )
          .run(purchaseOrderId, order.supplierId, now);

        this.db.db
          .prepare(
            `UPDATE purchase_orders
             SET status = 'Submitted',
                 total_amount = ?,
                 approval_required = ?,
                 submitted_at = ?,
                 updated_at = ?
             WHERE purchase_order_id = ?`,
          )
          .run(totalAmount, approvalRequired, now, now, purchaseOrderId);

        this.db.db
          .prepare(
            `INSERT INTO purchase_order_status_transitions (
              purchase_order_id,
              from_status,
              to_status,
              changed_by_user_id,
              changed_at,
              reason
            ) VALUES (?, 'Draft', 'Submitted', ?, ?, ?)`,
          )
          .run(purchaseOrderId, actorUserId, now, 'PO submitted');

        return 'submitted';
      });

      tx();
      const submitted = await this.findById(purchaseOrderId);

      if (!submitted) {
        throw new DatabaseError('Failed to retrieve submitted purchase order');
      }

      return submitted;
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof NotFoundError ||
        error instanceof ConflictError ||
        error instanceof DatabaseError
      ) {
        throw error;
      }
      handleDatabaseError(error);
    }
  }

  async decideApproval(
    purchaseOrderId: number,
    input: ApprovalDecisionInput,
  ): Promise<PurchaseOrder> {
    try {
      if (!Number.isInteger(input.approverUserId) || input.approverUserId <= 0) {
        throw new ValidationError('approverUserId must be a positive integer');
      }

      if (input.decision !== 'Approved' && input.decision !== 'Rejected') {
        throw new ValidationError('decision must be Approved or Rejected');
      }

      if (input.decision === 'Rejected' && (!input.reason || input.reason.trim() === '')) {
        throw new ValidationError('reason is required when decision is Rejected');
      }

      const tx = this.db.db.transaction(() => {
        const orderRow = this.db.db
          .prepare('SELECT * FROM purchase_orders WHERE purchase_order_id = ?')
          .get(purchaseOrderId) as DatabaseRow | undefined;

        if (!orderRow) {
          throw new NotFoundError('PurchaseOrder', purchaseOrderId);
        }

        const order = objectToCamelCase<PurchaseOrderRow>(orderRow);

        if (order.status !== 'Submitted') {
          throw new ConflictError(
            `Purchase order ${purchaseOrderId} cannot be approved from status ${order.status}`,
          );
        }

        const hasExistingDecision = this.db.db
          .prepare('SELECT COUNT(*) as count FROM purchase_order_approval_decisions WHERE purchase_order_id = ?')
          .get(purchaseOrderId) as { count?: number };

        if ((hasExistingDecision.count || 0) > 0) {
          throw new ConflictError(`Purchase order ${purchaseOrderId} already has an approval decision`);
        }

        if (Boolean(order.approvalRequired) && order.createdByUserId === input.approverUserId) {
          throw new DatabaseError(
            'Approver cannot approve their own purchase order',
            'FORBIDDEN',
            403,
          );
        }

        const now = this.nowIso();
        const nextStatus: PurchaseOrderStatus =
          input.decision === 'Approved' ? 'Approved' : 'Cancelled';

        this.db.db
          .prepare(
            `INSERT INTO purchase_order_approval_decisions (
              purchase_order_id,
              approver_user_id,
              decision,
              reason,
              decided_at
            ) VALUES (?, ?, ?, ?, ?)`,
          )
          .run(
            purchaseOrderId,
            input.approverUserId,
            input.decision,
            input.reason || null,
            now,
          );

        if (nextStatus === 'Approved') {
          this.db.db
            .prepare(
              `UPDATE purchase_orders
               SET status = 'Approved',
                   approved_at = ?,
                   updated_at = ?
               WHERE purchase_order_id = ?`,
            )
            .run(now, now, purchaseOrderId);
        } else {
          this.db.db
            .prepare(
              `UPDATE purchase_orders
               SET status = 'Cancelled',
                   cancelled_at = ?,
                   updated_at = ?
               WHERE purchase_order_id = ?`,
            )
            .run(now, now, purchaseOrderId);
        }

        this.db.db
          .prepare(
            `INSERT INTO purchase_order_status_transitions (
              purchase_order_id,
              from_status,
              to_status,
              changed_by_user_id,
              changed_at,
              reason
            ) VALUES (?, 'Submitted', ?, ?, ?, ?)`,
          )
          .run(
            purchaseOrderId,
            nextStatus,
            input.approverUserId,
            now,
            input.reason || `PO ${input.decision.toLowerCase()}`,
          );
      });

      tx();

      const decided = await this.findById(purchaseOrderId);
      if (!decided) {
        throw new DatabaseError('Failed to retrieve decided purchase order');
      }

      return decided;
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof NotFoundError ||
        error instanceof ConflictError ||
        error instanceof DatabaseError
      ) {
        throw error;
      }
      handleDatabaseError(error);
    }
  }

  async fulfillPurchaseOrder(
    purchaseOrderId: number,
    actorUserId: number,
  ): Promise<PurchaseOrder> {
    try {
      if (!Number.isInteger(actorUserId) || actorUserId <= 0) {
        throw new ValidationError('actorUserId must be a positive integer');
      }

      const tx = this.db.db.transaction(() => {
        const orderRow = this.db.db
          .prepare('SELECT * FROM purchase_orders WHERE purchase_order_id = ?')
          .get(purchaseOrderId) as DatabaseRow | undefined;

        if (!orderRow) {
          throw new NotFoundError('PurchaseOrder', purchaseOrderId);
        }

        const order = objectToCamelCase<PurchaseOrderRow>(orderRow);

        if (order.status !== 'Approved') {
          throw new ConflictError(
            `Purchase order ${purchaseOrderId} cannot be fulfilled from status ${order.status}`,
          );
        }

        const now = this.nowIso();

        this.db.db
          .prepare(
            `UPDATE purchase_orders
             SET status = 'Fulfilled',
                 fulfilled_at = ?,
                 updated_at = ?
             WHERE purchase_order_id = ?`,
          )
          .run(now, now, purchaseOrderId);

        this.db.db
          .prepare(
            `INSERT INTO purchase_order_status_transitions (
              purchase_order_id,
              from_status,
              to_status,
              changed_by_user_id,
              changed_at,
              reason
            ) VALUES (?, 'Approved', 'Fulfilled', ?, ?, ?)`,
          )
          .run(purchaseOrderId, actorUserId, now, 'PO fulfilled');
      });

      tx();

      const fulfilled = await this.findById(purchaseOrderId);
      if (!fulfilled) {
        throw new DatabaseError('Failed to retrieve fulfilled purchase order');
      }

      return fulfilled;
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof NotFoundError ||
        error instanceof ConflictError ||
        error instanceof DatabaseError
      ) {
        throw error;
      }
      handleDatabaseError(error);
    }
  }

  async cancelPurchaseOrder(
    purchaseOrderId: number,
    actorUserId: number,
    reason?: string,
  ): Promise<PurchaseOrder> {
    try {
      if (!Number.isInteger(actorUserId) || actorUserId <= 0) {
        throw new ValidationError('actorUserId must be a positive integer');
      }

      const normalizedReason = reason && reason.trim() !== '' ? reason.trim() : null;

      const tx = this.db.db.transaction(() => {
        const orderRow = this.db.db
          .prepare('SELECT * FROM purchase_orders WHERE purchase_order_id = ?')
          .get(purchaseOrderId) as DatabaseRow | undefined;

        if (!orderRow) {
          throw new NotFoundError('PurchaseOrder', purchaseOrderId);
        }

        const order = objectToCamelCase<PurchaseOrderRow>(orderRow);

        if (order.status !== 'Draft' && order.status !== 'Submitted') {
          throw new ConflictError(
            `Purchase order ${purchaseOrderId} cannot be cancelled from status ${order.status}`,
          );
        }

        const now = this.nowIso();

        this.db.db
          .prepare(
            `UPDATE purchase_orders
             SET status = 'Cancelled',
                 cancelled_at = ?,
                 updated_at = ?
             WHERE purchase_order_id = ?`,
          )
          .run(now, now, purchaseOrderId);

        this.db.db
          .prepare(
            `INSERT INTO purchase_order_status_transitions (
              purchase_order_id,
              from_status,
              to_status,
              changed_by_user_id,
              changed_at,
              reason
            ) VALUES (?, ?, 'Cancelled', ?, ?, ?)`,
          )
          .run(
            purchaseOrderId,
            order.status,
            actorUserId,
            now,
            normalizedReason || 'PO cancelled',
          );
      });

      tx();

      const cancelled = await this.findById(purchaseOrderId);
      if (!cancelled) {
        throw new DatabaseError('Failed to retrieve cancelled purchase order');
      }

      return cancelled;
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof NotFoundError ||
        error instanceof ConflictError ||
        error instanceof DatabaseError
      ) {
        throw error;
      }
      handleDatabaseError(error);
    }
  }

  async exists(id: number): Promise<boolean> {
    try {
      const result = await this.db.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM purchase_orders WHERE purchase_order_id = ?',
        [id],
      );
      return (result?.count || 0) > 0;
    } catch (error) {
      handleDatabaseError(error);
    }
  }
}

let purchaseOrdersRepo: PurchaseOrdersRepository | null = null;

export async function createPurchaseOrdersRepository(
  isTest: boolean = false,
  notificationDispatcher?: NotificationDispatcher,
): Promise<PurchaseOrdersRepository> {
  const db = await getDatabase(isTest);
  return new PurchaseOrdersRepository(db, notificationDispatcher);
}

export async function getPurchaseOrdersRepository(
  isTest: boolean = false,
): Promise<PurchaseOrdersRepository> {
  const isTestEnv = isTest || process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

  if (isTestEnv) {
    return createPurchaseOrdersRepository(true);
  }

  if (!purchaseOrdersRepo) {
    purchaseOrdersRepo = await createPurchaseOrdersRepository(false);
  }

  return purchaseOrdersRepo;
}

export function createFailingNotificationDispatcher(): NotificationDispatcher {
  return () => false;
}
