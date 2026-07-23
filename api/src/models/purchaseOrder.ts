import type { PurchaseOrderApprovalDecision } from './purchaseOrderApprovalDecision';
import type { PurchaseOrderLineItem, NewPurchaseOrderLineItem } from './purchaseOrderLineItem';
import type { SupplierNotificationEvent } from './supplierNotificationEvent';

export type PurchaseOrderStatus = 'Draft' | 'Submitted' | 'Approved' | 'Fulfilled' | 'Cancelled';

/**
 * @swagger
 * components:
 *   schemas:
 *     PurchaseOrderStatusTransition:
 *       type: object
 *       properties:
 *         purchaseOrderStatusTransitionId:
 *           type: integer
 *         purchaseOrderId:
 *           type: integer
 *         fromStatus:
 *           type: string
 *           nullable: true
 *         toStatus:
 *           type: string
 *           enum: [Draft, Submitted, Approved, Fulfilled, Cancelled]
 *         changedByUserId:
 *           type: integer
 *         changedAt:
 *           type: string
 *           format: date-time
 *         reason:
 *           type: string
 *
 *     PurchaseOrder:
 *       type: object
 *       required:
 *         - purchaseOrderId
 *         - branchId
 *         - supplierId
 *         - createdByUserId
 *         - status
 *         - totalAmount
 *         - lineItems
 *       properties:
 *         purchaseOrderId:
 *           type: integer
 *         branchId:
 *           type: integer
 *         supplierId:
 *           type: integer
 *         createdByUserId:
 *           type: integer
 *         status:
 *           type: string
 *           enum: [Draft, Submitted, Approved, Fulfilled, Cancelled]
 *         approvalRequired:
 *           type: boolean
 *         currencyCode:
 *           type: string
 *         totalAmount:
 *           type: number
 *           format: float
 *         submittedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         approvedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         fulfilledAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         cancelledAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         lineItems:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PurchaseOrderLineItem'
 *         approvalDecision:
 *           $ref: '#/components/schemas/PurchaseOrderApprovalDecision'
 *         transitions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PurchaseOrderStatusTransition'
 *         notificationEvents:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SupplierNotificationEvent'
 */

export interface PurchaseOrderStatusTransition {
  purchaseOrderStatusTransitionId: number;
  purchaseOrderId: number;
  fromStatus: PurchaseOrderStatus | null;
  toStatus: PurchaseOrderStatus;
  changedByUserId: number;
  changedAt: string;
  reason?: string | null;
}

export interface PurchaseOrder {
  purchaseOrderId: number;
  branchId: number;
  supplierId: number;
  createdByUserId: number;
  status: PurchaseOrderStatus;
  approvalRequired: boolean;
  currencyCode: string;
  totalAmount: number;
  submittedAt?: string | null;
  approvedAt?: string | null;
  fulfilledAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems: PurchaseOrderLineItem[];
  approvalDecision?: PurchaseOrderApprovalDecision | null;
  transitions: PurchaseOrderStatusTransition[];
  notificationEvents: SupplierNotificationEvent[];
}

export interface NewPurchaseOrder {
  branchId: number;
  supplierId: number;
  createdByUserId: number;
  currencyCode?: string;
  lineItems: NewPurchaseOrderLineItem[];
}
