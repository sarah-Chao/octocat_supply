/**
 * @swagger
 * components:
 *   schemas:
 *     SupplierNotificationEvent:
 *       type: object
 *       properties:
 *         supplierNotificationEventId:
 *           type: integer
 *         purchaseOrderId:
 *           type: integer
 *         supplierId:
 *           type: integer
 *         eventType:
 *           type: string
 *           enum: [PO_SUBMITTED]
 *         dispatchStatus:
 *           type: string
 *           enum: [Succeeded, Failed]
 *         dispatchedAt:
 *           type: string
 *           format: date-time
 *         failureReason:
 *           type: string
 */
export interface SupplierNotificationEvent {
  supplierNotificationEventId: number;
  purchaseOrderId: number;
  supplierId: number;
  eventType: 'PO_SUBMITTED';
  dispatchStatus: 'Succeeded' | 'Failed';
  dispatchedAt: string;
  failureReason?: string | null;
}
