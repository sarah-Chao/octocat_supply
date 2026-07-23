/**
 * @swagger
 * components:
 *   schemas:
 *     PurchaseOrderApprovalDecision:
 *       type: object
 *       properties:
 *         purchaseOrderApprovalDecisionId:
 *           type: integer
 *         purchaseOrderId:
 *           type: integer
 *         approverUserId:
 *           type: integer
 *         decision:
 *           type: string
 *           enum: [Approved, Rejected]
 *         reason:
 *           type: string
 *         decidedAt:
 *           type: string
 *           format: date-time
 */
export interface PurchaseOrderApprovalDecision {
  purchaseOrderApprovalDecisionId: number;
  purchaseOrderId: number;
  approverUserId: number;
  decision: 'Approved' | 'Rejected';
  reason?: string | null;
  decidedAt: string;
}
