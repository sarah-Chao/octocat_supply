<!--
Sync Impact Report
- Version change: N/A -> 1.0.0
- Modified principles:
	- Template Principle Slot 1 -> I. Library-First Reuse
	- Template Principle Slot 2 -> II. Contract-First TDD
	- Template Principle Slot 3 -> III. Integration Over Mocks
	- Template Principle Slot 4 -> IV. Simplicity Over Abstraction
	- Template Principle Slot 5 -> V. REST + OpenAPI Source of Truth
	- (added) VI. TypeScript Type Safety
	- (added) VII. Minimal Dependency Surface
- Added sections:
	- Engineering Standards
	- Delivery Workflow & Quality Gates
- Removed sections:
	- None
- Templates requiring updates:
	- ✅ updated: .specify/templates/plan-template.md
	- ✅ updated: .specify/templates/spec-template.md
	- ✅ updated: .specify/templates/tasks-template.md
- Follow-up TODOs:
	- None
-->

# OctoCAT Supply Chain Constitution

## Core Principles

### I. Library-First Reuse
All business capabilities MUST be implemented first as reusable modules with clear
boundaries and stable interfaces before feature-specific orchestration is added.
Shared logic MUST NOT be duplicated across routes, services, or UI flows.

Rationale: Reusable modules reduce drift, lower defect rates, and keep feature
delivery consistent across API and frontend surfaces.

### II. Contract-First TDD
For API behavior changes, contract tests and acceptance criteria MUST be authored
before implementation. Implementation MUST follow a red-green-refactor cycle:
write failing tests first, then add minimal code to pass.

Rationale: Contract-first TDD prevents ambiguous behavior and ensures externally
visible guarantees are validated before internal design choices are finalized.

### III. Integration Over Mocks
Repository and route integration tests MUST prefer real SQLite execution for
persistence behavior, migrations, and query correctness. Mocks MAY be used only
for external dependencies that cannot run in-process.

Rationale: Real-database tests catch schema, migration, and SQL regressions that
mock-based tests cannot reliably detect.

### IV. Simplicity Over Abstraction
Implementations MUST favor direct framework capabilities and straightforward
composition. New abstraction layers, wrappers, or patterns MUST include a written
justification proving measurable reduction in complexity or risk.

Rationale: Unnecessary abstractions slow onboarding and hide behavior without
providing proportional value.

### V. REST + OpenAPI Source of Truth
Public API changes MUST follow RESTful resource design and MUST update OpenAPI
documentation in the same change set. Route behavior, request/response schemas,
and documented contracts MUST remain consistent.

Rationale: Accurate OpenAPI contracts enable reliable client integration, testing,
and governance.

### VI. TypeScript Type Safety
Application code MUST be written in TypeScript with explicit domain types at API,
repository, and model boundaries. Use of untyped values or `any` MUST be
exceptional and documented with a rationale.

Rationale: Strong types make behavior explicit, reduce runtime defects, and
improve maintainability as the codebase evolves.

### VII. Minimal Dependency Surface
New dependencies MUST pass an explicit evaluation for necessity, maintenance
health, security posture, and bundle/runtime impact. Existing platform or
framework capabilities MUST be preferred when they satisfy requirements.

Rationale: Smaller dependency footprints reduce attack surface, upgrade burden,
and long-term operational risk.

## Engineering Standards

- API-facing changes MUST include OpenAPI updates, request/response validation,
	and backward compatibility notes.
- Data access changes MUST include migration compatibility checks and integration
	test coverage against SQLite.
- Cross-module contracts MUST be versioned through documented schema changes,
	not implicit behavior.
- Dependency additions MUST be captured in the plan and tasks artifacts with
	evaluation notes.

## Delivery Workflow & Quality Gates

- Planning artifacts MUST include a constitution compliance check before design
	and before implementation.
- Tasks MUST schedule contract/integration test authoring before implementation
	for each user story that changes behavior.
- Pull requests MUST demonstrate:
	- failing-to-passing test evidence for changed behavior,
	- updated OpenAPI/docs when API contracts change,
	- explicit rationale for any new abstraction or dependency.
- A change that violates any MUST rule cannot be merged without a documented
	constitution amendment.

## Governance

This constitution supersedes local conventions and ad hoc practices for the
OctoCAT Supply Chain project.

Amendment process:
1. Propose changes in `.specify/memory/constitution.md` with rationale and
	 migration impact.
2. Classify version impact using semantic versioning:
	 - MAJOR: incompatible principle removals or redefinitions,
	 - MINOR: new principle or materially expanded guidance,
	 - PATCH: clarifications without governance semantic change.
3. Update dependent templates and guidance files in the same amendment.

Compliance expectations:
- Every plan, spec, task list, and pull request review MUST include explicit
	constitution compliance verification.
- Exceptions are invalid unless merged with an approved constitution amendment.

**Version**: 1.0.0 | **Ratified**: 2026-07-23 | **Last Amended**: 2026-07-23
