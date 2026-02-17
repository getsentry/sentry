---
name: Clean Branch Reapply
overview: "Create a clean branch from master and iteratively reapply proven CI optimizations as polished commits (Proposal B: Feature Slices). Each step is independently runnable, tested, and benchmarked before progressing."
todos:
  - id: step-0-branch
    content: "Step 0: Create clean branch from origin/master"
    status: in_progress
  - id: step-1-bugfixes
    content: "Step 1: Bug fixes — generate, review together, commit, run, record baseline metrics"
    status: pending
  - id: step-2-classifier
    content: "Step 2: Classification pipeline — generate, review together, test classifier workflow"
    status: pending
  - id: step-3-xdist
    content: "Step 3: Single-tier xdist workflow (22 shards, -n 3) — generate, review, test, record metrics"
    status: pending
  - id: step-4-perworker
    content: "Step 4: Per-worker Snuba DB isolation — generate, review, test, record metrics"
    status: pending
  - id: step-5-h1
    content: "Step 5: Overlapped startup (H1) + parallel bootstrap — generate, review, test, record metrics"
    status: pending
  - id: step-6-tiering
    content: "Step 6: Two-tier split (5T1/17T2) — generate, review, test, record metrics"
    status: pending
isProject: false
---

# Clean Branch: Iterative Reapply with Benchmarking

## Approach

**Proposal B (Feature Slices):** Each commit is a complete, independently runnable increment. After each step, we push, trigger a CI run, and record performance metrics before moving on. This gives us a clear picture of what each optimization is actually worth.

**Cutoff:** We are porting only changes from the `87b94db` era (the proven 11m29s baseline). Later experiments (test-level classification, 3-tier split, Docker caching, reclassification) are left for future iterations.

## Metrics We Track

After each step's CI run completes, record:

- **Wall clock time** (total run duration, start of first shard to end of last)
- **Average shard time** (per tier if applicable, and overall)
- **Max shard time / Min shard time** (identifies outliers)
- **Total runner-minutes** (sum of all shard durations — measures cost)
- **Shard spread** (max - min, measures balance)

## Metrics Table

Fill in after each step's CI run:

| Step | Wall Clock | Avg (T1) | Avg (T2) | Avg (All) | Max | Min | Spread | Runner-Min | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 0 (master baseline) | | | | | | | | | No changes, just master |
| 1 (bug fixes) | | | | | | | | | Should match baseline |
| 3 (single-tier xdist) | | | | | | | | | All 22 shards identical config |
| 4 (per-worker Snuba) | | | | | | | | | Eliminates FORCE_SERIAL |
| 5 (H1 overlap) | | | | | | | | | Biggest expected gain |
| 6 (two-tier 5/17) | | | | | | | | | T1 drops Snuba setup |

(Step 2 is the classifier — it doesn't affect test runtime, just produces classification data.)

## Step-by-Step Plan

### Step 0: Create Clean Branch

- `git fetch origin && git checkout -b mchen/tiered-xdist-clean origin/master`
- Optionally trigger a baseline run of the existing backend tests on master for comparison metrics

### Step 1: Bug Fixes

Two pre-existing bugs exposed by xdist that must be fixed before parallel testing works:

**Files:**
- `src/sentry/testutils/pytest/sentry.py` — `TaskNamespace.send_task` session-level no-op patch (prevents real Kafka produces under xdist)
- Test file for `real_send_task` fixture (cherry-pick from `4d57aecb82a` or `b25ff3caa7d`)

**Process:** I generate the diff, you review/modify, we commit and push. Trigger a run — metrics should be identical to the master baseline since these are just safety fixes.

### Step 2: Classification Pipeline

Standalone tool that analyzes tests and produces `test-service-classification.json`. No impact on test execution — just infrastructure for later steps.

**Files:**
- `src/sentry/testutils/pytest/service_classifier.py` (new, ~272 lines) — pytest plugin that monkey-patches `socket.send`/`socket.sendall` to detect which services each test contacts at runtime
- `.github/workflows/classify-services.yml` (new, ~137 lines) — workflow that runs the classifier and uploads the JSON artifact

**Process:** I generate, you review. We trigger the classifier workflow to validate it produces correct output. No metrics run needed (doesn't change test execution).

### Step 3: Single-Tier xdist Workflow

The first big piece — a new workflow that runs all ~32K tests across 22 parallel shards using pytest-xdist (`-n 3`), with round-robin distribution.

**Files:**
- `.github/workflows/backend-xdist-split-poc.yml` (new) — 22-shard workflow, all shards use `backend-ci` mode (full Snuba stack), `-n 3` workers each
- `src/sentry/testutils/pytest/sentry.py` (modify) — add `SELECTED_TESTS_FILE` filtering in `pytest_collection_modifyitems`, round-robin `pytest_xdist_make_scheduler`, `_requires_snuba` wait/retry logic

**What this does NOT include yet:** No tiering (all shards run full devservices), no per-worker Snuba isolation, no overlapped startup. This is the "naive parallel" baseline.

**Process:** I generate, you review/modify. Push, run, record metrics. This establishes the xdist baseline before optimizations.

### Step 4: Per-Worker Snuba Database Isolation

Gives each xdist worker its own ClickHouse database and Snuba API instance. Eliminates `TRUNCATE` conflicts between workers and removes the need for `FORCE_SERIAL` (26 test files that previously had to run serially).

**Files:**
- `src/sentry/testutils/pytest/sentry.py` (modify) — add `_xdist_per_worker_snuba` autouse fixture that routes Snuba queries to worker-specific port
- `src/sentry/testutils/pytest/kafka.py` (modify) — per-worker Kafka topic names
- `src/sentry/testutils/pytest/relay.py` (modify) — per-worker Kafka topics + Redis DB index
- `.github/workflows/backend-xdist-split-poc.yml` (modify) — add per-worker ClickHouse DB creation + Snuba container bootstrap in the run step
- `.github/workflows/per-worker-db-smoke-test.yml` (new) — validation workflow

**Process:** I generate, you review/modify. Push, run, record metrics. Expect improvement from eliminating serial bottleneck.

### Step 5: Overlapped Startup (H1) + Parallel Bootstrap

The biggest single optimization. Instead of waiting for devservices to start before running pytest, start them in parallel — pytest collection (~100-120s) overlaps with service startup.

**Files:**
- `.github/workflows/backend-xdist-split-poc.yml` (modify) — restructure run step:
  - `setup-sentry` with `skip-devservices: true`
  - Background subshell: `sentry init` + `devservices up` + per-worker bootstrap (concurrent `bootstrap --force` + health checks)
  - Foreground: pytest starts immediately, `_requires_snuba` waits for services
- `src/sentry/testutils/skips.py` (modify) — `_wait_for_service()` polls per-worker port with `SNUBA_WAIT_TIMEOUT=300s`

**Process:** I generate, you review/modify. Push, run, record metrics. Expect ~80-100s improvement per shard.

### Step 6: Two-Tier Split (5 T1 / 17 T2)

Split tests by service dependency. Tier 1 (Postgres + Redis only) skips the entire Snuba stack, saving ~100-150s of setup per shard.

**Files:**
- `.github/workflows/scripts/split-tests-by-tier.py` (new) — reads classification JSON, outputs tier file lists at file-level granularity
- `.github/workflows/backend-xdist-split-poc.yml` (modify) — split into `split-tiers` job + `tier1-test` (5 shards, `migrations` mode) + `tier2-test` (17 shards, `backend-ci` mode)

**Process:** I generate, you review/modify. Push, run, record metrics. This should land us at or near the 11m29s target.

## What We're NOT Including (future work)

These are post-`87b94db` experiments left for future iterations:

- Test-level classification (`--granularity test` instead of `file`)
- `SENTRY_SKIP_SNUBA_CHECK` reclassification (Optimization D)
- 3-tier split (tier2-heavy isolation)
- `backend-ci-light` devservices mode
- Docker image pre-pull (F1)
- Shard rebalancing beyond 5/17
- `docs/service-classification-investigation.md` (dev journal, keep locally)

## Potential Merge Conflicts

- `src/sentry/testutils/pytest/sentry.py` — upstream has Kafka taskbroker fix (`4d57aecb82a`) and selective testing config fix (`9ced888ad52`). Needs careful merge.
- `devservices/config.yml` — upstream added launchpad, shared postgres, symbolicator-tests mode. Low risk (we're just adding a mode).
- `src/sentry/testutils/skips.py` — minor upstream changes. Low risk.
