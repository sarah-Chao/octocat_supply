# Quickstart: Purchase Order Management System Validation

## Purpose

Validate the purchase-order feature end-to-end against the contract,
state-transition rules, approval governance, and notification rollback behavior.

## Prerequisites

- Repository checked out at branch `001-purchase-order-management`
- Node dependencies installed for API workspace
- SQLite migration + seed flow available through existing scripts

## Setup

1. Build API artifacts:

```bash
make build-api
```

2. Seed and initialize local database state:

```bash
cd api
npm run db:seed:dev
```

3. Confirm API test stack is available:

```bash
npm test -- --runInBand
```

## Validation Scenarios

### Scenario 1: Create Draft PO and Submit Successfully

1. Create a draft PO with multiple line items via `POST /purchase-orders`.
2. Submit via `POST /purchase-orders/{purchaseOrderId}/submit`.
3. Verify:
   - Status transitions `Draft -> Submitted`
   - Submission timestamp set
   - Exactly one successful `PO_SUBMITTED` notification event

Expected result: HTTP 201 for create, HTTP 200 for submit, PO in `Submitted`.

### Scenario 2: Submission Rollback on Notification Failure

1. Force notification dispatch failure condition in test fixture.
2. Submit a valid draft PO.
3. Verify:
   - Submit endpoint returns failure response (contracted 502)
   - PO remains in `Draft`
   - No persisted partial transition to `Submitted`

Expected result: submission does not commit state change.

### Scenario 3: High-Value Approval Governance

1. Submit PO where total exceeds $10,000.
2. Attempt approval by PO creator.
3. Attempt approval by authorized non-creator approver.
4. Verify:
   - Creator approval rejected with authorization error
   - Non-creator approval accepted
   - Status transitions `Submitted -> Approved`

Expected result: separation of duties enforced.

### Scenario 4: Fulfillment Rule

1. Attempt fulfillment before approval.
2. Approve PO.
3. Fulfill PO via `POST /purchase-orders/{purchaseOrderId}/fulfill`.
4. Verify:
   - Pre-approval fulfillment is rejected
   - Post-approval fulfillment succeeds
   - Status transitions `Approved -> Fulfilled`

Expected result: only approved POs can be fulfilled.

### Scenario 5: Idempotent Submit Behavior

1. Submit same draft PO request more than once.
2. Verify:
   - No duplicate successful supplier notification events
   - State remains consistent and no invalid transition side effects

Expected result: idempotency guarantee is preserved.

## Contract and Data-Model Cross-Checks

- Confirm endpoint payloads match [contracts/purchase-orders.openapi.yaml](contracts/purchase-orders.openapi.yaml).
- Confirm entity and transition semantics match [data-model.md](data-model.md).

## Suggested Focused Test Commands (after implementation)

```bash
cd api
npm test -- src/routes/purchaseOrder.test.ts
npm test -- src/repositories/purchaseOrdersRepo.test.ts
npm test -- src/routes/purchaseOrder.contract.test.ts
```

## Exit Criteria

- All contract tests pass.
- All SQLite-backed integration tests pass.
- OpenAPI contract and route behavior stay consistent.
- Governance controls (approval threshold, separation of duties, rollback-on-notify-failure) are validated.
