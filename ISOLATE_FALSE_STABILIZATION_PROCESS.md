# Isolate False Stabilization Process

## Goal

Run Vitest with `isolate: false` globally (for speed) while keeping all tests deterministic.

## Overall Approach Used In This Conversation

1. Enable `isolate: false` in Vitest config.
2. Run broad/full test batches and capture JSON output.
3. Parse only failed suites/assertions from JSON.
4. Reproduce failures in smaller targeted batches.
5. Patch tests/setup to remove cross-file state assumptions.
6. Re-run targeted batch.
7. Re-run full batch.
8. Repeat until full pass.

## Core Triage Loop

1. **Full run snapshot**
   - Run full Vitest with JSON output.
   - Record:
     - failed suites
     - failed assertions
     - error messages / missing mock endpoints
2. **Targeted repro**
   - Run only failing files together.
   - If they pass in isolation but fail in full run, treat as worker-state bleed/order dependency.
3. **Fix class selection**
   - Choose fix type by signature:
     - missing API mock: add required endpoint mock(s)
     - async race: replace immediate assertions with `waitFor`/`findBy*`
     - stale module/store/router state: move setup from module scope to `beforeEach`
     - global mutation leak (DOM APIs, observers, timers): restore originals in `afterEach/afterAll`
4. **Validate**
   - Re-run that failing cluster.
   - If green, run full suite again to expose next layer.

## High-Value Fix Patterns We Applied

- Add global Reflux store resets and re-init in `tests/js/vitest-setup.ts`.
- Add explicit global RTL cleanup in setup (`afterEach(cleanup)`).
- Reset URL/navigation state per test (jsdom reconfigure/history fallback).
- Normalize fragile globals each test (e.g. focus descriptor handling).
- Move mutable setup from module scope into `beforeEach` in flaky specs.
- Add missing `MockApiClient` responses for endpoints only hit in some issue types/routes.
- Replace brittle synchronous assertions with awaited assertions where UI state is async.
- Restore mutated globals (`ResizeObserver`, `IntersectionObserver`, `scrollTo`, RAF, etc.) after tests.

## Guardrails Followed

- Prefer minimal, local test fixes over broad global behavior changes.
- Avoid persistent top-level mocks that can leak under `isolate: false`.
- Keep tests explicit about router context and initial route/query state.
- Keep each test self-contained:
  - own mocks
  - own store/page filter state
  - own cleanup of global overrides

## Verification Cadence

- After each patch set:
  1. run targeted failing files
  2. run full suite
  3. compare failure set against previous iteration
- Treat any growth in failures as regression from recent changes, then roll back/scope down.

## Current Status (at time of writing)

- Progress reduced full-run failures from large multi-file instability to a small tail.
- Most recent checkpoint before this doc request:
  - full run: `13,788 passed / 6 failed`
  - after targeted fixes: only 1 deterministic failure remained in targeted batch:
    - `static/app/views/issueDetails/streamline/eventDetailsHeader.spec.tsx`
    - test: `renders occurrence summary if enabled`

## Practical Command Pattern Used

- Full run (JSON):
  - `CI=true pnpm test:vitest-run --reporter=json --outputFile=/tmp/<run>.json`
- Failure extraction:
  - `jq` over `.testResults[]` filtering `.status=="failed"`
- Targeted run:
  - `CI=true pnpm test:vitest-run <file1> <file2> ... --reporter=json --outputFile=/tmp/<target>.json`

## Exit Criteria

- Full Vitest run passes with `isolate: false`.
- No file-init errors.
- No recurring order-dependent flake signatures in repeat full runs.
