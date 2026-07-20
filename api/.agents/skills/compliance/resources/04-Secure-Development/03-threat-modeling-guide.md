---
title: "Threat Modeling Guide"
category: "Secure Development"
version: 1.0
last_updated: "2025-10-20"
owner: "Security Team"
keywords: [threat modeling, STRIDE, security design, risk assessment]
---

# Threat Modeling Guide

Threat modeling is a structured approach to identifying, quantifying, and addressing security risks in a system. This guide describes how to apply threat modeling at OctoCAT Supply.

## When to Threat Model

Perform a threat model when:
- Designing a new feature that handles sensitive data or authentication
- Modifying existing security boundaries (e.g., new API endpoints, permission changes)
- Introducing new infrastructure or third-party integrations

## Process Overview

### 1. Define the Scope

- Identify the feature or system under review
- List all entry points (API routes, UI inputs, file uploads, external integrations)
- List all assets to protect (user data, credentials, business logic, PDFs)

### 2. Create a Data Flow Diagram (DFD)

Draw a simple diagram showing:
- **External entities** (browser, mobile app, third-party service)
- **Processes** (API handlers, background jobs)
- **Data stores** (SQLite DB, filesystem)
- **Data flows** (HTTP requests, DB queries, file reads)
- **Trust boundaries** (public internet → API → internal DB)

### 3. Identify Threats Using STRIDE

For each data flow and process, evaluate the following threat categories:

| Category | Description | Example |
|---|---|---|
| **S**poofing | Impersonating another user or system | Forging a JWT token |
| **T**ampering | Modifying data in transit or at rest | Altering an order record |
| **R**epudiation | Denying an action without proof | User claims they never placed an order |
| **I**nformation Disclosure | Exposing data to unauthorized parties | Leaking a file via path traversal |
| **D**enial of Service | Making the system unavailable | Flooding the download endpoint |
| **E**levation of Privilege | Gaining higher permissions than granted | Accessing admin routes without the admin role |

### 4. Rate and Prioritize Risks

Use a simple risk matrix (Likelihood × Impact):

| Likelihood \ Impact | Low | Medium | High |
|---|---|---|---|
| **High** | Medium | High | Critical |
| **Medium** | Low | Medium | High |
| **Low** | Low | Low | Medium |

Focus remediation effort on **Critical** and **High** items first.

### 5. Define Mitigations

For each identified threat, document:
- **Mitigation**: the control or code change that reduces the risk
- **Owner**: the engineer or team responsible
- **Status**: Open / In Progress / Resolved

### 6. Review and Update

- Revisit the threat model when the feature changes significantly
- Include the threat model summary in the PR description for security-relevant changes

## Example: File Download Endpoint

| Threat | STRIDE Category | Mitigation |
|---|---|---|
| Attacker crafts `../../../etc/passwd` as filename | Information Disclosure | Validate filename with regex; resolve path and verify it is inside the base directory |
| Attacker supplies unsupported language code | Tampering / Information Disclosure | Validate `lang` against an allow-list |
| Bot scrapes all PDFs | Denial of Service / Information Disclosure | Bot detection via User-Agent; rate limiting |
| Non-PDF file served | Information Disclosure | Reject filenames that do not end in `.pdf` |
