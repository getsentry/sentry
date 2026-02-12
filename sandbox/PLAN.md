# Sentry Development Sandbox Infrastructure

## Implementation Plan

This document describes the phased implementation of sandbox infrastructure for AI agent workflows and faster developer onboarding. Each phase delivers standalone value.

---

## Phase 1: Pre-built Image Pipeline

**Goal**: Nightly Docker images with Python deps pre-installed and Postgres databases pre-migrated. Useful for CI, agent sandboxes, and developer onboarding independently of later phases.

### 1.1 `Dockerfile.agent` — Agent sandbox image

**File**: `sandbox/images/Dockerfile.agent`

Builds an image containing:
- Python 3.13 + full `.venv` with all deps from `uv.lock`
- The Sentry codebase installed via `fast_editable`
- `sentry` CLI available on PATH
- Pre-commit hooks, pytest, mypy available
- Node.js + pnpm + `node_modules` (for frontend lint/typecheck)

**Key design decisions**:
- Based on `python:3.13.1-slim-bookworm` (matches existing self-hosted Dockerfile)
- Uses `pypi.devinfra.sentry.io` as PIP index (via `--index-url` in build arg / secret)
- Two-stage approach: deps layer cached separately from codebase layer
- `node_modules` included for frontend tooling (typecheck, lint) — ~2.4 GB but cached as a layer
- Image tagged with both `nightly` and content-hash tags for cache invalidation

**Private PyPI handling**:
- During CI build, mount the PyPI credentials as a Docker build secret
- `uv sync` uses `--index-url` pointed at `pypi.devinfra.sentry.io`
- No credentials baked into the image

### 1.2 `Dockerfile.postgres` — Pre-migrated Postgres image

**File**: `sandbox/images/Dockerfile.postgres`

Builds a Postgres 17 image with:
- All 4 databases created: `sentry`, `control`, `region`, `secondary`
- All 253+ migrations applied across all apps
- Superuser `admin@sentry.io` created
- Dumps loaded via `docker-entrypoint-initdb.d` for instant startup

**Build process** (multi-stage):
1. Stage 1 ("migrator"): Start from `sentry-agent:nightly` + official postgres image, run postgres, apply migrations, `pg_dump` all 4 databases
2. Stage 2: Copy dumps into a clean Postgres image's `docker-entrypoint-initdb.d/`

Since migrations require a running Postgres and the Sentry Python environment, the actual build is orchestrated by a script (`sandbox/scripts/build-postgres-image.sh`) rather than a pure Dockerfile:
1. Start a temporary Postgres container
2. Run `sentry upgrade --noinput` against it (using the agent image)
3. `pg_dump` all 4 databases
4. Build the final image with dumps baked in

### 1.3 CI Workflow — Nightly + on-change builds

**File**: `.github/workflows/sandbox-images.yml`

**Triggers**:
- Nightly schedule (`cron: '0 6 * * *'` — 6am UTC)
- On push to `master` when relevant files change:
  - `uv.lock` → rebuild agent image
  - `src/sentry/*/migrations/**` → rebuild postgres image
  - `pnpm-lock.yaml` → rebuild agent image

**Cache strategy**:
- Images tagged with content hashes for deterministic cache keys:
  - Agent: `sha256(uv.lock + pnpm-lock.yaml + .python-version)[:12]`
  - Postgres: `sha256(all migration files)[:12]`
- Also tagged: `nightly`, `YYYY-MM-DD`, git SHA
- Skip build if GHCR already has the content-hash tag (idempotent)

**Image registry**: `ghcr.io/getsentry/sentry-agent` and `ghcr.io/getsentry/sentry-postgres-dev`

### 1.4 Validation

- CI job that pulls `sentry-agent:nightly` and runs `sentry --help`
- CI job that starts `sentry-postgres-dev:nightly` and verifies all 4 databases exist with correct schema
- CI job that runs a small pytest suite inside the agent image against the postgres image

### 1.5 Risks and open questions

| Risk | Mitigation |
|------|------------|
| Private PyPI creds in Docker build | Use `--mount=type=secret` in Dockerfile, never bake into layers |
| Image size (agent image will be ~4-6 GB) | Accept for now; layer caching makes pulls fast after first download |
| Migration ordering across apps | `sentry upgrade --noinput` handles ordering; test in CI |
| Build time for postgres image (~3-5 min) | Only rebuild on migration changes; nightly is fine |
| pnpm-lock.yaml churn causing frequent rebuilds | Content-hash tags avoid redundant builds |

---

## Phase 2: Agent Sandbox Runtime

**Goal**: A Docker Compose-based runtime that gives an agent an isolated environment with Sentry + Postgres + Redis, ready to run tests in under 30 seconds.

### 2.1 Execution platform recommendation

**Recommended: GKE Autopilot pods**

| Option | Pros | Cons |
|--------|------|------|
| **GKE Autopilot** (recommended) | Auto-scaling, per-pod billing, built-in image caching, k8s-native networking | Slight cold start (~15-30s for pod scheduling) |
| GCE instances | Full control, always warm | Idle cost, manual scaling, snowflake infra |
| Modal | Zero infra management, fast cold start | Vendor lock-in, less control, egress costs |
| GitHub Actions | Already integrated | No persistent sandboxes, 6hr timeout, limited control |

GKE Autopilot is the best fit because:
- Sentry already uses GCP — no new vendor relationship
- Autopilot handles node provisioning, so you only pay for pod resources
- Image streaming (enabled by default on Autopilot) means large images pull fast
- Pods can run Docker Compose sidecars via sidecar containers pattern
- Warm pool possible via pod pre-provisioning (PriorityClass-based)

For the **initial implementation**, run sandboxes as **local Docker Compose** stacks invoked by the harness. This works on developer laptops, CI, and can be orchestrated by any platform. GKE migration is an optimization for Phase 2b.

### 2.2 Docker Compose for sandbox

**File**: `sandbox/runtime/docker-compose.sandbox.yml`

Three services:
- `agent`: The `sentry-agent:nightly` image with the codebase mounted (or baked in)
- `postgres`: The `sentry-postgres-dev:nightly` image, pre-migrated
- `redis`: Standard Redis 7 image

The agent container:
- Keeps running (entrypoint is `sleep infinity` or a command server)
- Exposes a way to exec commands into it
- Has `/workspace` as the working directory with the Sentry codebase
- Can overlay changed files from the agent's work

### 2.3 Agent interaction model

**Recommended: `docker exec` with a thin wrapper**

Agents interact by:
1. Harness creates the sandbox (`docker compose up -d`)
2. Agent sends commands via `docker exec agent <command>`
3. Results returned via stdout/stderr + exit code
4. Files can be copied in/out via `docker cp`
5. Sandbox destroyed when agent is done (`docker compose down -v`)

This is the simplest model that supports iterative workflows. The agent keeps the sandbox alive across multiple commands — no cold start between iterations.

For GKE (Phase 2b), this becomes `kubectl exec` with the same semantics.

### 2.4 Warm pool strategy

For production agent workloads on GKE:
- Pre-provision N sandbox pods using a low-priority `PriorityClass`
- When an agent needs a sandbox, bump priority → pod binds immediately
- Pool size auto-adjusts based on queue depth
- Saves ~15-30s cold start per sandbox

For the initial Docker Compose approach, pre-pulling images is sufficient (`docker compose pull`).

### 2.5 Security and resource limits

- Each sandbox runs in an isolated Docker network (no cross-sandbox communication)
- Resource limits per sandbox: 4 CPU, 8 GB RAM (configurable)
- No internet access from agent container (optional, configurable)
- 30-minute maximum sandbox lifetime (configurable)
- Read-only bind mounts where possible
- No Docker socket access inside the sandbox

### 2.6 Validation

- Script that creates a sandbox, runs `pytest tests/sentry/api/test_organization_details.py`, verifies pass
- Benchmark: measure time from "create sandbox" to "first test result"
- Load test: run 10 sandboxes concurrently on a single machine

### 2.7 Risks and open questions

| Risk | Mitigation |
|------|------------|
| Docker Compose not available in all environments | Provide alternative k8s manifests for GKE |
| Resource contention with many sandboxes | Enforce limits; right-size based on benchmarking |
| Stale images in sandbox | Pin to content-hash tags, not `nightly` |
| Agent escaping sandbox | No Docker socket; network isolation; drop capabilities |
| Long-running sandboxes leaking resources | Enforce TTL with auto-cleanup |

---

## Phase 3: Agent Harness / SDK

**Goal**: A Python library and CLI that wraps the sandbox lifecycle, making it easy for any AI agent to create a sandbox, run commands, and get results.

### 3.1 Python SDK

**File**: `sandbox/harness/sentry_sandbox/__init__.py` and related modules

```python
from sentry_sandbox import Sandbox

async with Sandbox.create(image_tag="nightly") as sb:
    # Run tests
    result = await sb.exec("pytest -xvs tests/sentry/api/test_organization_details.py")
    print(result.exit_code, result.stdout, result.stderr)

    # Copy files in
    await sb.copy_in("src/sentry/api/endpoints/organization_details.py", local_path)

    # Run linter
    result = await sb.exec("pre-commit run --files src/sentry/api/endpoints/organization_details.py")

    # Get file out
    content = await sb.read_file("src/sentry/api/endpoints/organization_details.py")
```

### 3.2 CLI wrapper

**File**: `sandbox/harness/sentry_sandbox/cli.py`

```bash
# Create a sandbox and get its ID
sentry-sandbox create --tag nightly
# => sandbox-a1b2c3d4

# Execute a command
sentry-sandbox exec sandbox-a1b2c3d4 -- pytest -xvs tests/sentry/api/test_base.py

# Copy files in/out
sentry-sandbox cp-in sandbox-a1b2c3d4 src/sentry/foo.py ./local/foo.py
sentry-sandbox cp-out sandbox-a1b2c3d4 /workspace/test-results.xml ./results.xml

# Destroy
sentry-sandbox destroy sandbox-a1b2c3d4

# One-shot: create, exec, destroy
sentry-sandbox run --tag nightly -- pytest -xvs tests/sentry/api/test_base.py
```

### 3.3 Test file mapping

**File**: `sandbox/harness/sentry_sandbox/testmap.py`

Maps changed source files to their test files:
- `src/sentry/api/endpoints/foo.py` → `tests/sentry/api/endpoints/test_foo.py`
- `src/sentry/models/foo.py` → `tests/sentry/models/test_foo.py`
- Uses naming conventions + import analysis as fallback
- Outputs a list of test files to run

### 3.4 Task types

The harness supports task "presets" that configure the sandbox appropriately:

| Task | Command | Services needed |
|------|---------|-----------------|
| `run-tests` | `pytest -xvs <files>` | postgres, redis |
| `run-linter` | `pre-commit run --files <files>` | none |
| `run-typecheck-py` | `mypy <files>` | none |
| `run-typecheck-js` | `pnpm run typecheck` | none |
| `run-lint-js` | `pnpm run lint:js <files>` | none |

For tasks that don't need services, the harness can skip starting postgres/redis for faster startup.

### 3.5 Validation

- Unit tests for the SDK (mocking Docker)
- Integration tests that create a real sandbox and run a test suite
- CLI smoke tests

### 3.6 Risks and open questions

| Risk | Mitigation |
|------|------------|
| Docker SDK version compatibility | Pin docker-py version; test in CI |
| Test file mapping accuracy | Start with convention-based; iterate |
| Async vs sync SDK | Provide both; async primary, sync wrapper |

---

## Phase 4: Developer Environments

**Goal**: Leverage the pre-built images to speed up developer onboarding and provide remote dev environment options.

### 4.1 Faster local onboarding via pre-built images

**File**: `sandbox/scripts/fast-setup.sh`

New `devenv sync` optimization path:
1. Check if `sentry-postgres-dev:latest` content-hash matches current migrations
2. If yes: `docker run` the pre-migrated postgres instead of running migrations (~5s vs ~120s)
3. If no: fall back to normal migration path, then optionally rebuild snapshot
4. Similar for venv: check if `sentry-agent:latest` has the right `uv.lock` hash
5. If yes: copy `.venv` from the image (~10s vs ~60s)
6. If no: run `uv sync` normally

This is opt-in and complementary to the existing `devenv sync` flow.

**Integration point**: Modify `devenv/sync.py` to check for pre-built images before running slow operations.

### 4.2 Delta migration support

When the pre-migrated Postgres image is slightly behind (e.g., 2 new migrations since last build):
1. Start from the pre-built postgres image
2. Detect which migrations have already been applied (via `django_migrations` table)
3. Run only the delta migrations
4. Result: ~5-10s instead of ~120s for a few new migrations

### 4.3 Remote development environments

**Recommended: GitHub Codespaces** (with pre-built images)

| Option | Pros | Cons |
|--------|------|------|
| **Codespaces** (recommended) | GitHub-native, devcontainer support, managed | Cost per developer-hour, Microsoft dependency |
| Cloud Workstations (GCP) | GCP-native, persistent | More setup, less IDE integration |
| GCE + code-server | Full control, always warm | Operational burden, snowflake |
| Gitpod | Fast, devcontainer-ish | Third-party vendor |

Codespaces with a `devcontainer.json` that:
- Uses the `sentry-agent:nightly` as the base image (venv + node_modules pre-installed)
- Starts `sentry-postgres-dev:nightly` and Redis as Docker Compose services
- Sets up port forwarding for the dev server
- Developer is coding within seconds of Codespace creation

**Docker-in-Docker**: Codespaces supports Docker natively. The devservices Docker Compose can run inside the Codespace. The pre-built images make this fast because they're pre-pulled in the Codespace prebuild.

**File**: `sandbox/runtime/devcontainer.json` (Codespace configuration)

### 4.4 Validation

- Time `devenv sync` with and without pre-built image optimization
- Create a Codespace and verify full dev environment works (run tests, start devserver, hot reload)
- Verify delta migration path works correctly

### 4.5 Risks and open questions

| Risk | Mitigation |
|------|------------|
| Codespaces cost ($0.18/hr for 4-core) | Use prebuilds to minimize startup; auto-stop idle |
| Docker-in-Docker performance in Codespaces | Test; Codespaces uses lightweight VM, not nested Docker |
| devenv sync changes require careful testing | Feature-flag behind env var; opt-in initially |
| Delta migration state mismatch | Always verify against `django_migrations` table; fall back to full |

---

## Phase Dependencies

```
Phase 1 (Images) ──────────────────────────────────────
        │
        ├── Phase 2 (Runtime) ─────────────────────────
        │         │
        │         └── Phase 3 (Harness/SDK) ───────────
        │
        └── Phase 4 (Dev Environments) ────────────────
```

- Phase 1 is a prerequisite for all other phases
- Phase 2 depends on Phase 1 (needs the images)
- Phase 3 depends on Phase 2 (wraps the runtime)
- Phase 4 depends on Phase 1 only (uses images directly)
- Phases 2+3 and Phase 4 can be developed in parallel

---

## File Manifest

### Phase 1
| File | Purpose |
|------|---------|
| `sandbox/images/Dockerfile.agent` | Agent sandbox image with Python+Node deps |
| `sandbox/images/Dockerfile.postgres` | Postgres image entrypoint with pre-migrated dump |
| `sandbox/scripts/build-postgres-image.sh` | Script to orchestrate postgres image build |
| `.github/workflows/sandbox-images.yml` | CI: nightly + on-change image builds |
| `sandbox/scripts/compute-cache-key.sh` | Compute content-hash cache keys |

### Phase 2
| File | Purpose |
|------|---------|
| `sandbox/runtime/docker-compose.sandbox.yml` | Compose file for agent sandboxes |
| `sandbox/runtime/sentry.conf.py` | Sentry config for sandbox environment |

### Phase 3
| File | Purpose |
|------|---------|
| `sandbox/harness/pyproject.toml` | Harness package config |
| `sandbox/harness/sentry_sandbox/__init__.py` | SDK entry point |
| `sandbox/harness/sentry_sandbox/sandbox.py` | Core sandbox lifecycle |
| `sandbox/harness/sentry_sandbox/cli.py` | CLI interface |
| `sandbox/harness/sentry_sandbox/testmap.py` | Source→test file mapping |

### Phase 4
| File | Purpose |
|------|---------|
| `sandbox/runtime/devcontainer.json` | Codespaces configuration |
| `sandbox/scripts/fast-setup.sh` | Fast local setup using pre-built images |
