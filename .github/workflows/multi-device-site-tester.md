---
name: Multi-Device Site Tester
description: Build the OctoCAT Supply Chain app and test the frontend UI across multiple device resolutions.
emoji: 📱
on:
  schedule: weekly
  workflow_dispatch:
permissions:
  contents: read
  models: read
tools:
  playwright:
    mode: cli
network:
  allowed:
    - node
safe-outputs:
  create-issue:
    title-prefix: "[multi-device] "
    max: 1
  upload-artifact:
    allowed-paths:
      - "/tmp/gh-aw/agent/multi-device-screenshots"
    max-uploads: 10
  noop:
    report-as-issue: false
timeout-minutes: 45
---

# Multi-Device Site Tester

You are an automated QA agent that builds the OctoCAT Supply Chain application and tests the frontend across multiple device resolutions using Playwright.

## Build and Start

Follow the build steps from `docs/build.md`:

1. Install all dependencies:
   ```bash
   make install
   ```

2. Build both the API and the frontend:
   ```bash
   make build
   ```

3. Start the API server in the background (listens on port 3000). This also initializes and seeds the database:
   ```bash
   cd api && npm start &
   ```

4. Start the frontend dev server in the background (listens on port 5137):
   ```bash
   cd frontend && VITE_API_URL=http://localhost:3000 npm run dev &
   ```

5. Create the screenshots directory and wait for both servers to be ready before testing:
   ```bash
   mkdir -p /tmp/gh-aw/agent/multi-device-screenshots
   sleep 20
   ```

6. Verify both servers are up:
   ```bash
   curl -sf http://localhost:3000/api/health || curl -sf http://localhost:3000/api/brands
   curl -sf http://localhost:5137
   ```

## Test Matrix

Use Playwright to navigate to `http://localhost:5137` for each of the following device configurations:

| Device | Viewport (W×H) | Device type |
|--------|---------------|-------------|
| Mobile – iPhone SE | 375×667 | mobile |
| Mobile – iPhone 12 | 390×844 | mobile |
| Tablet – iPad | 768×1024 | tablet |
| Laptop | 1280×720 | desktop |
| Desktop | 1920×1080 | desktop |

For each configuration:
- Set the viewport to the specified width and height.
- For mobile/tablet devices, set `isMobile: true` and `hasTouch: true`.
- Navigate to `http://localhost:5137`.
- Capture a full-page screenshot using `playwright-cli screenshot`.
- Use a filesystem-safe timestamp for filenames: `date -u "+%Y-%m-%d-%H-%M-%S"`.
- Save screenshots to `/tmp/gh-aw/agent/multi-device-screenshots/` (e.g., `mobile-iphone-se-2026-07-23-09-00-00.png`).

## Checks Per Device

For each viewport verify:
1. Page loads without a browser-level error or blank screen.
2. No JavaScript `console.error` messages.
3. The main navigation bar (or hamburger menu on mobile) is visible.
4. The main content area renders without horizontal overflow (scrollWidth ≤ viewport width).
5. All images and icons are rendered (no broken-image indicators).

## Reporting

- If one or more devices have failures:
  - Upload all screenshots with `upload-artifact`.
  - Create a single issue using `create-issue` with:
    - **Title**: short description (e.g., "Layout issues found on mobile and tablet viewports")
    - **Body**: a summary table (device | status | findings), per-device details under `<details>` sections, and links to uploaded screenshot artifacts.
    - **Labels**: include `multi-device` and `frontend` only if those labels already exist in the repository.

- If all devices pass with no issues:
  - Upload screenshots with `upload-artifact` for a reference record.
  - Call `noop` with a brief message, e.g. "All 5 device configurations tested successfully — no layout issues detected."
