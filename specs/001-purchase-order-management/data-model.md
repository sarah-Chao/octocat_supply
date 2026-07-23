# Data Model: Purchase Order Management System

## Entity: PurchaseOrder

- Purpose: Top-level purchase document created by a branch buyer and sent to a supplier.
- Fields:
  - `id` (string, UUID-like identifier)
  - `branchId` (string, required, FK -> Branch)
  - `supplierId` (string, required, FK -> Supplier)
  - `createdByUserId` (string, required, FK -> UserDetail)
  - `status` (enum: `Draft | Submitted | Approved | Fulfilled | Cancelled`, required)
  - `approvalRequired` (boolean, derived from total > 10000.00 at submission)
  - `currencyCode` (string, default `USD`)
  - `totalAmount` (number, required, non-negative, sum of line totals)
  - `submittedAt` (datetime, nullable)
  - `approvedAt` (datetime, nullable)
  - `fulfilledAt` (datetime, nullable)
  - `cancelledAt` (datetime, nullable)
  - `createdAt` (datetime, required)
  - `updatedAt` (datetime, required)
- Relationships:
  - 1:N with `PurchaseOrderLineItem`
  - 1:N with `PurchaseOrderStatusTransition`
  - 0..1 with `PurchaseOrderApprovalDecision`
  - 0..N with `SupplierNotificationEvent`

## Entity: PurchaseOrderLineItem

- Purpose: Product-level request details inside a purchase order.
- Fields:
  - `id` (string)
  - `purchaseOrderId` (string, required, FK -> PurchaseOrder)
  - `productId` (string, required, FK -> Product)
  - `quantity` (integer, required, > 0)
  - `expectedUnitPrice` (number, required, > 0)
  - `lineTotal` (number, required, = quantity * expectedUnitPrice)
  - `createdAt` (datetime, required)
  - `updatedAt` (datetime, required)
- Validation rules:
  - Quantity must be positive integer.
  - Expected unit price must be positive and finite.
  - Line total must be recalculated server-side and not trusted from client input.

## Entity: PurchaseOrderApprovalDecision

- Purpose: Captures explicit approval/rejection for high-value submitted POs.
- Fields:
  - `id` (string)
  - `purchaseOrderId` (string, required, unique FK -> PurchaseOrder)
  - `approverUserId` (string, required, FK -> UserDetail)
  - `decision` (enum: `Approved | Rejected`, required)
  - `reason` (string, required for rejection)
  - `decidedAt` (datetime, required)
- Validation rules:
  - Decision allowed only when PO is `Submitted` and `approvalRequired=true`.
  - `approverUserId` must not equal `createdByUserId`.

## Entity: PurchaseOrderStatusTransition

- Purpose: Immutable audit trail of status changes for each PO.
- Fields:
  - `id` (string)
  - `purchaseOrderId` (string, required, FK -> PurchaseOrder)
  - `fromStatus` (enum, nullable for create event)
  - `toStatus` (enum, required)
  - `changedByUserId` (string, required)
  - `changedAt` (datetime, required)
  - `reason` (string, optional)

## Entity: SupplierNotificationEvent

- Purpose: Records supplier notification dispatch attempts tied to submission.
- Fields:
  - `id` (string)
  - `purchaseOrderId` (string, required, FK -> PurchaseOrder)
  - `supplierId` (string, required, FK -> Supplier)
  - `eventType` (enum: `PO_SUBMITTED`, required)
  - `dispatchStatus` (enum: `Succeeded | Failed`, required)
  - `dispatchedAt` (datetime, required)
  - `failureReason` (string, nullable)
- Validation rules:
  - Successful PO submission must create exactly one successful `PO_SUBMITTED` event.
  - Failed dispatch during submission must not transition PO to `Submitted`.

## State Transitions

Allowed transitions:

1. `Draft -> Submitted`
   - Preconditions:
     - At least one valid line item.
     - Required supplier/branch metadata present.
     - Submission-critical supplier notification succeeds.
   - Effects:
     - `submittedAt` set.
     - `approvalRequired` computed from total (`totalAmount > 10000.00`).

2. `Submitted -> Approved`
   - Preconditions:
     - If `approvalRequired=true`, decision by authorized approver who is not PO creator.
     - If `approvalRequired=false`, system or workflow can still mark approved in normal flow.
   - Effects:
     - Approval decision captured (for manual approval case).
     - `approvedAt` set.

3. `Submitted -> Cancelled`
   - Preconditions:
     - Explicit rejection or cancellation action.
   - Effects:
     - Cancellation reason recorded.
     - `cancelledAt` set.

4. `Approved -> Fulfilled`
   - Preconditions:
     - Buyer confirms fulfillment action.
   - Effects:
     - `fulfilledAt` set.

5. `Draft -> Cancelled`
   - Preconditions:
     - Buyer cancels draft.
   - Effects:
     - `cancelledAt` set.

Forbidden transitions:

- Any transition from `Fulfilled` to other states.
- Any transition from `Cancelled` to other states.
- `Submitted -> Fulfilled` direct transition.
- Approval action by PO creator for approval-required POs.

## Derived Computations

- `lineTotal = quantity * expectedUnitPrice`
- `totalAmount = sum(lineTotal for all line items)`
- `approvalRequired = totalAmount > 10000.00` at submission evaluation time

## Data Integrity Constraints

- One approval decision record per PO at most.
- Idempotent submit: repeated submit requests for already-submitted PO do not create duplicate successful notification events.
- Status transition write must be atomic with status update.
