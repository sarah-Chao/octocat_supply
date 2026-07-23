/**
 * @swagger
 * components:
 *   schemas:
 *     PurchaseOrderLineItem:
 *       type: object
 *       required:
 *         - productId
 *         - quantity
 *         - expectedUnitPrice
 *       properties:
 *         purchaseOrderLineItemId:
 *           type: integer
 *         purchaseOrderId:
 *           type: integer
 *         productId:
 *           type: integer
 *         quantity:
 *           type: integer
 *           minimum: 1
 *         expectedUnitPrice:
 *           type: number
 *           format: float
 *         lineTotal:
 *           type: number
 *           format: float
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */
export interface PurchaseOrderLineItem {
  purchaseOrderLineItemId: number;
  purchaseOrderId: number;
  productId: number;
  quantity: number;
  expectedUnitPrice: number;
  lineTotal: number;
  createdAt: string;
  updatedAt: string;
}

export type NewPurchaseOrderLineItem = Pick<
  PurchaseOrderLineItem,
  'productId' | 'quantity' | 'expectedUnitPrice'
>;
