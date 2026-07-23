# Tasks: Purchase Order Management System

**Input**: Design documents from `/specs/001-purchase-order-management/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test tasks are REQUIRED for behavior changes. Contract tests MUST be defined before implementation for external contracts, and integration tests MUST cover persistence behavior using the real project database engine.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare contract and documentation scaffolding for implementation.

- [x] T001 Align purchase-order contract details in specs/001-purchase-order-management/contracts/purchase-orders.openapi.yaml
- [x] T002 Prepare implementation task notes and mapping in specs/001-purchase-order-management/plan.md
- [x] T003 [P] Add purchase-order API section placeholder in api/api-swagger.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build database and shared domain foundations required by all user stories.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Create purchase-order tables and constraints migration in api/database/migrations/004_create_purchase_orders.sql
- [x] T005 [P] Add purchase-order TypeScript models in api/src/models/purchaseOrder.ts
- [x] T006 [P] Add purchase-order line item model in api/src/models/purchaseOrderLineItem.ts
- [x] T007 [P] Add approval decision model in api/src/models/purchaseOrderApprovalDecision.ts
- [x] T008 [P] Add supplier notification event model in api/src/models/supplierNotificationEvent.ts
- [x] T009 Implement repository base CRUD/query methods in api/src/repositories/purchaseOrdersRepo.ts
- [x] T010 Implement lifecycle transition guard helpers in api/src/repositories/purchaseOrdersRepo.ts
- [x] T011 Register purchase-order route wiring in api/src/index.ts
- [x] T012 Add repository integration test scaffold with real SQLite setup in api/src/repositories/purchaseOrdersRepo.test.ts

**Checkpoint**: Foundation ready; user stories can proceed.

---

## Phase 3: User Story 1 - Create and Submit Purchase Order (Priority: P1) 🎯 MVP

**Goal**: Branch buyers can create draft POs with line items and submit valid drafts with transactional rollback on notification failure.

**Independent Test**: Create draft with multiple items, submit successfully, then force notification failure and verify rollback to Draft.

### Tests for User Story 1 (REQUIRED) ⚠️

- [x] T013 [P] [US1] Add OpenAPI contract test for create and submit endpoints in api/src/routes/purchaseOrder.contract.test.ts
- [x] T014 [P] [US1] Add route integration tests for draft creation and validation failures in api/src/routes/purchaseOrder.test.ts
- [x] T015 [P] [US1] Add repository integration tests for submit transaction and rollback-on-notification-failure in api/src/repositories/purchaseOrdersRepo.test.ts

### Implementation for User Story 1

- [x] T016 [US1] Implement create draft purchase-order route handler in api/src/routes/purchaseOrder.ts
- [x] T017 [US1] Implement submit purchase-order route handler with idempotency checks in api/src/routes/purchaseOrder.ts
- [x] T018 [US1] Implement draft validation, totals recomputation, and line-item rules in api/src/repositories/purchaseOrdersRepo.ts
- [x] T019 [US1] Implement submission-critical supplier notification dispatch with transaction rollback in api/src/repositories/purchaseOrdersRepo.ts
- [x] T020 [US1] Add status transition persistence for Draft->Submitted in api/src/repositories/purchaseOrdersRepo.ts
- [x] T021 [US1] Expose purchase-order routes from API router entrypoint in api/src/index.ts

**Checkpoint**: User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - High-Value Approval Workflow (Priority: P2)

**Goal**: Submitted POs over $10,000 require authorized non-creator approval before fulfillment.

**Independent Test**: Submit PO over threshold, verify creator cannot approve, verify authorized non-creator can approve/reject, and threshold edge case at $10,000 bypasses manual approval.

### Tests for User Story 2 (REQUIRED) ⚠️

- [x] T022 [P] [US2] Add contract test for approval decision endpoint in api/src/routes/purchaseOrder.contract.test.ts
- [x] T023 [P] [US2] Add route integration tests for approval/rejection and creator-blocked approval in api/src/routes/purchaseOrder.test.ts
- [x] T024 [P] [US2] Add repository integration tests for threshold logic and separation-of-duties enforcement in api/src/repositories/purchaseOrdersRepo.test.ts

### Implementation for User Story 2

- [x] T025 [US2] Implement approval decision route handler in api/src/routes/purchaseOrder.ts
- [x] T026 [US2] Implement high-value approval-required evaluation (>10000) in api/src/repositories/purchaseOrdersRepo.ts
- [x] T027 [US2] Implement separation-of-duties authorization and decision recording in api/src/repositories/purchaseOrdersRepo.ts
- [x] T028 [US2] Implement Submitted->Approved and Submitted->Cancelled transition writes in api/src/repositories/purchaseOrdersRepo.ts

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Supplier Notification and Lifecycle Tracking (Priority: P3)

**Goal**: Suppliers receive single submission notifications and users can inspect full PO lifecycle history through fulfillment/cancellation.

**Independent Test**: Submit PO once, verify exactly one successful supplier notification event and visible transition history, then fulfill approved PO and verify final state.

### Tests for User Story 3 (REQUIRED) ⚠️

- [x] T029 [P] [US3] Add contract test for get, fulfill, and cancel lifecycle endpoints in api/src/routes/purchaseOrder.contract.test.ts
- [x] T030 [P] [US3] Add route integration tests for lifecycle history retrieval and fulfill/cancel transitions in api/src/routes/purchaseOrder.test.ts
- [x] T031 [P] [US3] Add repository integration tests for notification-event uniqueness and immutable terminal states in api/src/repositories/purchaseOrdersRepo.test.ts

### Implementation for User Story 3

- [x] T032 [US3] Implement get purchase-order details endpoint including transitions and notification metadata in api/src/routes/purchaseOrder.ts
- [x] T033 [US3] Implement fulfill and cancel endpoint handlers in api/src/routes/purchaseOrder.ts
- [x] T034 [US3] Implement Approved->Fulfilled and Draft/Submitted->Cancelled transition rules with terminal-state guards in api/src/repositories/purchaseOrdersRepo.ts
- [x] T035 [US3] Implement lifecycle history query and response mapping in api/src/repositories/purchaseOrdersRepo.ts

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, documentation, and validation across all stories.

- [ ] T036 [P] Update API Swagger output and purchase-order endpoint docs in api/api-swagger.json
- [ ] T037 [P] Update feature quickstart verification notes after implementation in specs/001-purchase-order-management/quickstart.md
- [ ] T038 Run focused purchase-order route and repository test suites in api/src/routes/purchaseOrder.test.ts
- [ ] T039 Run focused purchase-order contract tests in api/src/routes/purchaseOrder.contract.test.ts
- [ ] T040 Run full API test pass to verify no regressions in api/package.json

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies; start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1; blocks all user stories.
- **Phase 3 (US1)**: Depends on Phase 2 completion.
- **Phase 4 (US2)**: Depends on Phase 2 completion; can proceed after US1 core submit behavior is stable.
- **Phase 5 (US3)**: Depends on Phase 2 completion and lifecycle operations from US1/US2.
- **Phase 6 (Polish)**: Depends on completion of selected user stories.

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational phase; no dependency on other stories.
- **US2 (P2)**: Starts after Foundational phase; uses submit behavior from US1 but remains independently testable.
- **US3 (P3)**: Starts after Foundational phase; depends on lifecycle states produced by US1 and US2.

### Within Each User Story

- Tests MUST be written and fail before implementation.
- Route and repository implementations follow failing tests.
- State transition persistence is implemented before endpoint completion checks.

### Parallel Opportunities

- T003 can run alongside T001/T002.
- T005-T008 are parallel model tasks after migration planning starts.
- Contract test tasks (T013, T022, T029) can run in parallel with integration test authoring tasks.
- Repository and route test authoring within each story can run in parallel.
- Polish documentation tasks (T036, T037) can run in parallel before final test execution.

---

## Parallel Example: User Story 1

```bash
# Parallel test authoring for US1
Task: "T013 [US1] Add OpenAPI contract test for create and submit endpoints in api/src/routes/purchaseOrder.contract.test.ts"
Task: "T014 [US1] Add route integration tests for draft creation and validation failures in api/src/routes/purchaseOrder.test.ts"
Task: "T015 [US1] Add repository integration tests for submit transaction and rollback-on-notification-failure in api/src/repositories/purchaseOrdersRepo.test.ts"

# Parallel model foundation work feeding US1
Task: "T005 Add purchase-order TypeScript models in api/src/models/purchaseOrder.ts"
Task: "T006 Add purchase-order line item model in api/src/models/purchaseOrderLineItem.ts"
Task: "T007 Add approval decision model in api/src/models/purchaseOrderApprovalDecision.ts"
Task: "T008 Add supplier notification event model in api/src/models/supplierNotificationEvent.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2 foundations.
2. Deliver Phase 3 (US1) including rollback-on-notification-failure.
3. Validate with US1 contract and integration tests before proceeding.

### Incremental Delivery

1. Foundation first (Phases 1-2).
2. Deliver US1 (core PO creation/submission).
3. Deliver US2 (approval governance).
4. Deliver US3 (notification/lifecycle retrieval and final transitions).
5. Finish with Phase 6 polish and full regression tests.

### Parallel Team Strategy

1. Developer A: migration + repository core (T004, T009, T010).
2. Developer B: route and contract tests (T013, T022, T029 and related route handlers).
3. Developer C: lifecycle and approval integration tests (T015, T024, T031) plus docs polish.

---

## Notes

- [P] tasks indicate no direct dependency conflicts and can be executed concurrently.
- [USx] labels map each task to its user story for independent validation.
- Contract-first and SQLite integration-test-first ordering is mandatory per constitution.
- Do not introduce new dependencies unless constitution exception is approved.
