/**
 * @swagger
 * tags:
 *   name: PurchaseOrders
 *   description: API endpoints for managing purchase orders
 */

/**
 * @swagger
 * /api/purchase-orders:
 *   post:
 *     summary: Create a draft purchase order
 *     tags: [PurchaseOrders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PurchaseOrder'
 *     responses:
 *       201:
 *         description: Draft purchase order created successfully
 *       400:
 *         description: Validation error
 *
 * /api/purchase-orders/{id}:
 *   get:
 *     summary: Get a purchase order by ID
 *     tags: [PurchaseOrders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Purchase order found
 *       404:
 *         description: Purchase order not found
 *
 * /api/purchase-orders/{id}/submit:
 *   post:
 *     summary: Submit a draft purchase order
 *     tags: [PurchaseOrders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Purchase order submitted
 *       404:
 *         description: Purchase order not found
 *       409:
 *         description: Invalid status transition
 *       502:
 *         description: Supplier notification dispatch failed
 *
 * /api/purchase-orders/{id}/approval-decisions:
 *   post:
 *     summary: Apply approval decision for a submitted purchase order
 *     tags: [PurchaseOrders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Approval decision applied
 *       403:
 *         description: Approval forbidden due to separation-of-duties policy
 *       404:
 *         description: Purchase order not found
 *       409:
 *         description: Invalid state transition
 */

import express from 'express';
import {
  ConflictError,
  DatabaseError,
  NotFoundError,
  ValidationError,
} from '../utils/errors';
import {
  createFailingNotificationDispatcher,
  createPurchaseOrdersRepository,
  getPurchaseOrdersRepository,
} from '../repositories/purchaseOrdersRepo';
import type { NewPurchaseOrder } from '../models/purchaseOrder';

const router = express.Router();

function parseId(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new ValidationError('ID must be a positive integer');
  }
  return parsed;
}

router.post('/', async (req, res, next) => {
  try {
    const payload = req.body as NewPurchaseOrder;
    const repo = await getPurchaseOrdersRepository();
    const created = await repo.createDraft(payload);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const purchaseOrderId = parseId(req.params.id);
    const repo = await getPurchaseOrdersRepository();
    const order = await repo.findById(purchaseOrderId);

    if (!order) {
      throw new NotFoundError('PurchaseOrder', purchaseOrderId);
    }

    res.json(order);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/submit', async (req, res, next) => {
  try {
    const purchaseOrderId = parseId(req.params.id);
    const actorUserId = Number(req.body?.actorUserId);

    if (!Number.isInteger(actorUserId) || actorUserId <= 0) {
      throw new ValidationError('actorUserId must be a positive integer');
    }

    const forceFailure =
      process.env.NODE_ENV === 'test' && req.headers['x-force-notification-failure'] === 'true';

    const repo = forceFailure
      ? await createPurchaseOrdersRepository(true, createFailingNotificationDispatcher())
      : await getPurchaseOrdersRepository();

    const submitted = await repo.submitDraft(purchaseOrderId, actorUserId, {
      forceNotificationFailure: forceFailure,
    });

    res.json(submitted);
  } catch (error) {
    if (
      error instanceof ValidationError ||
      error instanceof NotFoundError ||
      error instanceof ConflictError ||
      error instanceof DatabaseError
    ) {
      next(error);
      return;
    }

    next(error);
  }
});

router.post('/:id/approval-decisions', async (req, res, next) => {
  try {
    const purchaseOrderId = parseId(req.params.id);
    const approverUserId = Number(req.body?.approverUserId);
    const decision = req.body?.decision;
    const reason = req.body?.reason;

    const repo = await getPurchaseOrdersRepository();
    const decided = await repo.decideApproval(purchaseOrderId, {
      approverUserId,
      decision,
      reason,
    });

    res.json(decided);
  } catch (error) {
    if (
      error instanceof ValidationError ||
      error instanceof NotFoundError ||
      error instanceof ConflictError ||
      error instanceof DatabaseError
    ) {
      next(error);
      return;
    }

    next(error);
  }
});

export default router;
