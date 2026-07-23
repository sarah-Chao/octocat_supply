# Phase 0 Research: Purchase Order Management System

## Decision 1: Lifecycle State Model Uses Only Five Primary Statuses

- Decision: Keep only `Draft`, `Submitted`, `Approved`, `Fulfilled`, `Cancelled` as primary states; for high-value POs, approval-required remains represented while status is `Submitted`.
- Rationale: Matches clarified requirement, avoids expanding state machine complexity, and preserves compatibility with existing status-driven route/repository patterns.
- Alternatives considered:
  - Add `PendingApproval` as a sixth status: rejected because it contradicts clarified requirement and adds migration/transition complexity.
  - Auto-approve all submitted POs: rejected because it breaks high-value governance controls.

## Decision 2: Submission Is Transactional with Notification as a Commit Gate

- Decision: Treat supplier notification dispatch as submission-critical. If notification dispatch fails, submission fails and PO remains `Draft`.
- Rationale: Directly satisfies clarified rule and eliminates partial state where PO is submitted without supplier awareness.
- Alternatives considered:
  - Submit first and retry notification asynchronously: rejected because it violates clarified rollback behavior.
  - Submit first and log notification failure only: rejected because it can silently break supplier coordination.

## Decision 3: Approval Separation of Duties Is Enforced

- Decision: Enforce policy that PO creator cannot approve their own PO when approval is required.
- Rationale: Required by clarification and reduces financial control risk for >$10,000 orders.
- Alternatives considered:
  - Allow self-approval: rejected due to governance risk.
  - Allow self-approval with optional second review: rejected because requirement explicitly disallows creator approval.

## Decision 4: Fulfillment Transition Rule

- Decision: Allow `Approved -> Fulfilled` transition based on explicit buyer confirmation action.
- Rationale: Aligns with final clarification and keeps flow simple for the current scope.
- Alternatives considered:
  - Require supplier receipt confirmation artifact before `Fulfilled`: rejected for current scope simplicity.
  - Allow `Submitted -> Fulfilled`: rejected because it bypasses approval controls.

## Decision 5: Contract-First Verification Strategy

- Decision: Define REST + OpenAPI contracts first, then create failing contract/integration tests before implementation.
- Rationale: Required by constitution and ensures external API behavior is stable and testable before coding details.
- Alternatives considered:
  - Implementation-first then docs/tests: rejected because it conflicts with constitution principle II and V.

## Decision 6: Real SQLite Integration Coverage

- Decision: Route and repository integration tests run against real SQLite schema/migrations.
- Rationale: Required by constitution principle III; validates migration SQL, constraints, and transaction behavior accurately.
- Alternatives considered:
  - Mocked repository tests only: rejected because mock tests miss SQL and transactional edge cases.

## Decision 7: Dependency Strategy

- Decision: Add no new dependencies; use existing Express, better-sqlite3, Vitest, and Supertest stack.
- Rationale: Satisfies minimal dependency principle and avoids unnecessary package risk.
- Alternatives considered:
  - Introduce workflow/state-machine library: rejected as over-abstraction for current scope.
  - Introduce notification queue package: rejected because clarified behavior requires synchronous submission gating.
