# Sentry Development Sandbox Infrastructure Plan

## Architecture Overview

```
                    ┌──────────────────────────────────────┐
                    │     Phase 1: Image Pipeline (GHA)    │
                    │                                      │
                    │  ┌──────────┐    ┌────────────────┐  │
                    │  │Dockerfile│    │  Dockerfile     │  │
                    │  │  .agent  │    │  .postgres      │  │
                    │  └────┬─────┘    └───────┬────────┘  │
                    │       │                  │           │
                    │       ▼                  ▼           │
                    │   ghcr.io/          ghcr.io/         │
                    │   getsentry/        getsentry/       │
                    │   sentry-agent      sentry-postgres  │
                    │   :nightly          :nightly         │
                    └──────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌──────────────┐ ┌──────────┐ ┌──────────────┐
            │   Phase 2    │ │ Phase 3  │ │   Phase 4    │
            │   Agent      │ │ Agent    │ │   Dev        │
            │   Sandbox    │ │ Harness  │ │   Envs       │
            │   Runtime    │ │ SDK      │ │              │
            └──────────────┘ └──────────┘ └──────────────┘
```

---

## Phase 1: Pre-built Image Pipeline

### Goal
Build and publish Docker images nightly (and on relevant changes) so that both agent sandboxes and developer environments can start in <30 seconds instead of 3-5 minutes.

### 1.1 Dockerfile.agent

**File**: `docker/sandbox/Dockerfile.agent`

This image contains the Python virtualenv with all dependencies installed and the full codebase. It is NOT the production `self-hosted/Dockerfile` — it's purpose-built for running tests and linters.

```dockerfile
FROM python:3.13.1-slim-bookworm AS base

RUN groupadd -r sentry --gid 1000 && useradd -r -m -g sentry --uid 1000 sentry

RUN : \
    && apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        gcc \
        git \
        libpcre2-dev \
        libpq-dev \
        make \
        zlib1g-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/sentry

ENV PATH="/.venv/bin:$PATH" \
    UV_PROJECT_ENVIRONMENT=/.venv \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UV_COMPILE_BYTECODE=1

# Install uv from private PyPI
RUN python3 -m pip install --index-url 'https://pypi.devinfra.sentry.io/simple' 'uv==0.9.28'
RUN python3 -m venv /.venv

# Install Python dependencies first (layer caching)
COPY uv.lock pyproject.toml ./
RUN --mount=type=secret,id=pypi_token \
    PIP_INDEX_URL="https://pypi.devinfra.sentry.io/simple" \
    uv sync --frozen --quiet --no-install-project

# Copy codebase
COPY . .
RUN python3 -m tools.fast_editable --path .

# Install pre-commit hooks into the image so lint runs don't download them
RUN git init --bare /tmp/.git-dummy \
    && pre-commit install-hooks

# Default working directory for agent operations
WORKDIR /usr/src/sentry
USER sentry

CMD ["bash"]
```

**Key design decisions**:
- Based on `self-hosted/Dockerfile` patterns but without JS build assets, entrypoint, or sentry config — purely for backend test/lint execution
- `gcc`, `libpcre2-dev`, `zlib1g-dev` kept installed (not purged) because agents may need to install additional packages
- `git` included because selective testing, pre-commit, and many workflows need it
- `pre-commit install-hooks` baked in so `pre-commit run` doesn't download hooks at runtime
- Private PyPI handled via `--mount=type=secret` at build time (see CI workflow section)

### 1.2 Dockerfile.postgres

**File**: `docker/sandbox/Dockerfile.postgres`

This image contains Postgres with all 4 databases created, all migrations applied, and a superuser created. The key insight: run migrations during build, `pg_dump`, and bake the dumps into the entrypoint init directory.

```dockerfile
FROM postgres:17-bookworm AS builder

# We need Python + Sentry to run migrations
FROM python:3.13.1-slim-bookworm AS migrator

RUN : \
    && apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        gcc libpcre2-dev libpq-dev zlib1g-dev postgresql-client make \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/sentry

ENV PATH="/.venv/bin:$PATH" UV_PROJECT_ENVIRONMENT=/.venv \
    PIP_NO_CACHE_DIR=1 UV_COMPILE_BYTECODE=1

RUN python3 -m pip install --index-url 'https://pypi.devinfra.sentry.io/simple' 'uv==0.9.28'
RUN python3 -m venv /.venv

COPY uv.lock pyproject.toml ./
RUN --mount=type=secret,id=pypi_token \
    PIP_INDEX_URL="https://pypi.devinfra.sentry.io/simple" \
    uv sync --frozen --quiet --no-install-project

COPY . .
RUN python3 -m tools.fast_editable --path .

# --- Migration runner script ---
# This script starts Postgres, runs migrations, dumps, and stops Postgres
COPY docker/sandbox/run-migrations.sh /run-migrations.sh
RUN chmod +x /run-migrations.sh

# Start a temporary Postgres, apply migrations, dump databases
# The script produces /dumps/*.sql
RUN --mount=type=tmpfs,target=/var/lib/postgresql/data \
    /run-migrations.sh

# --- Final image ---
FROM postgres:17-bookworm

# Copy the SQL dumps into the entrypoint init directory
# Postgres will automatically restore these on first start
COPY --from=migrator /dumps/sentry.sql /docker-entrypoint-initdb.d/01-sentry.sql
COPY --from=migrator /dumps/control.sql /docker-entrypoint-initdb.d/02-control.sql
COPY --from=migrator /dumps/region.sql /docker-entrypoint-initdb.d/03-region.sql
COPY --from=migrator /dumps/secondary.sql /docker-entrypoint-initdb.d/04-secondary.sql

ENV POSTGRES_HOST_AUTH_METHOD=trust \
    POSTGRES_USER=postgres
```

**File**: `docker/sandbox/run-migrations.sh`

```bash
#!/bin/bash
set -euo pipefail

# Start Postgres temporarily
pg_ctlcluster 17 main start

# Wait for Postgres to be ready
until pg_isready -h 127.0.0.1 -U postgres; do sleep 0.5; done

# Create the 4 databases (matching scripts/lib.sh create-db)
for db in sentry control region secondary; do
    createdb -h 127.0.0.1 -U postgres -E utf-8 "$db" || true
done

# Apply all migrations
export SENTRY_CONF=/tmp/sentry-conf
mkdir -p "$SENTRY_CONF"
sentry init --dev
sentry upgrade --noinput

# Create superuser
sentry createuser --superuser --email admin@sentry.io --password admin --no-input

# Dump each database
mkdir -p /dumps
for db in sentry control region secondary; do
    pg_dump -h 127.0.0.1 -U postgres --format=plain "$db" > "/dumps/${db}.sql"
done

pg_ctlcluster 17 main stop
```

**Startup time**: Postgres `docker-entrypoint-initdb.d` SQL restore for 4 databases takes ~5-10 seconds vs. ~60-120 seconds for running 266 migrations from scratch.

### 1.3 CI Workflow

**File**: `.github/workflows/sandbox-images.yml`

```yaml
name: sandbox images

on:
  # Nightly build
  schedule:
    - cron: '0 6 * * *'  # 6am UTC daily

  # On relevant file changes to master
  push:
    branches: [master]
    paths:
      - 'uv.lock'
      - 'pyproject.toml'
      - 'src/*/migrations/**'
      - 'docker/sandbox/**'

  workflow_dispatch:

concurrency:
  group: sandbox-images-${{ github.ref }}
  cancel-in-progress: true

env:
  AGENT_IMAGE: ghcr.io/getsentry/sentry-agent
  POSTGRES_IMAGE: ghcr.io/getsentry/sentry-postgres

jobs:
  build-agent:
    runs-on: ubuntu-24.04
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/setup-buildx-action@v3

      # Cache key: hash of uv.lock determines if venv layer is reusable
      - name: Build and push agent image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: docker/sandbox/Dockerfile.agent
          push: true
          tags: |
            ${{ env.AGENT_IMAGE }}:${{ github.sha }}
            ${{ env.AGENT_IMAGE }}:nightly
            ${{ env.AGENT_IMAGE }}:uv-${{ hashFiles('uv.lock') }}
          cache-from: |
            type=registry,ref=${{ env.AGENT_IMAGE }}:buildcache
          cache-to: |
            type=registry,ref=${{ env.AGENT_IMAGE }}:buildcache,mode=max
          secrets: |
            pypi_token=${{ secrets.PYPI_DEVINFRA_TOKEN }}

  build-postgres:
    runs-on: ubuntu-24.04
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/setup-buildx-action@v3

      # Cache key: hash of all migration files
      - name: Build and push postgres image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: docker/sandbox/Dockerfile.postgres
          push: true
          tags: |
            ${{ env.POSTGRES_IMAGE }}:${{ github.sha }}
            ${{ env.POSTGRES_IMAGE }}:nightly
            ${{ env.POSTGRES_IMAGE }}:migrations-${{ hashFiles('src/*/migrations/**/*.py') }}
          cache-from: |
            type=registry,ref=${{ env.POSTGRES_IMAGE }}:buildcache
          cache-to: |
            type=registry,ref=${{ env.POSTGRES_IMAGE }}:buildcache,mode=max
          secrets: |
            pypi_token=${{ secrets.PYPI_DEVINFRA_TOKEN }}
```

### 1.4 Image Tagging Strategy

| Tag | When | Purpose |
|-----|------|---------|
| `:nightly` | Daily 6am UTC | Default tag for sandboxes and dev envs |
| `:<sha>` | Every build | Pinning to exact code version |
| `:uv-<hash>` | Agent image | Cache key — skip rebuild if deps unchanged |
| `:migrations-<hash>` | Postgres image | Cache key — skip rebuild if migrations unchanged |

### 1.5 Private PyPI Handling

The private registry `pypi.devinfra.sentry.io` is already referenced in `pyproject.toml` as the default index. During Docker builds:

- Use `--mount=type=secret,id=pypi_token` to pass credentials at build time without baking them into layers
- The CI workflow passes `PYPI_DEVINFRA_TOKEN` from GitHub secrets
- The `PIP_INDEX_URL` env var is set during `uv sync` to point to the private registry

Since `pypi.devinfra.sentry.io` is already configured as the default index in `pyproject.toml`, and `uv sync --frozen` just needs network access to it, no additional configuration is needed beyond ensuring the build runner can reach the registry. If the registry requires auth, the secret mount handles it.

### 1.6 Files to Create

```
docker/sandbox/
├── Dockerfile.agent
├── Dockerfile.postgres
├── run-migrations.sh
└── docker-compose.sandbox.yml    (Phase 2)

.github/workflows/
└── sandbox-images.yml
```

### 1.7 Risks & Open Questions

1. **Migration build time**: Running 266 migrations inside Docker build could take 2-3 minutes. The multi-stage build keeps this isolated and the result is cached.
2. **Private PyPI auth in CI**: Need to confirm whether `pypi.devinfra.sentry.io` requires authentication for reads, or only for publishes. The existing `self-hosted/Dockerfile` uses `--index-url 'https://pypi.devinfra.sentry.io/simple'` without auth, suggesting reads are public.
3. **Image size**: The agent image will be ~2-3 GB (Python 3.13 base + 589 MB venv + codebase + git + build tools). Consider a `.dockerignore` excluding `node_modules/`, `static/`, `.git/` (agent can `git init` + fetch specific refs as needed).
4. **Postgres version alignment**: The `devservices` config uses whatever Postgres version `sentry-shared-postgres` provides. Ensure `Dockerfile.postgres` uses the same major version.

### 1.8 Validation

- Build images locally: `docker build -f docker/sandbox/Dockerfile.agent -t sentry-agent:local .`
- Run agent container, verify pytest works: `docker run --rm sentry-agent:local pytest --co -q tests/sentry/api/test_base.py`
- Run postgres container, verify databases exist: `docker exec <container> psql -U postgres -l`
- Verify migration state: `docker exec <container> psql -U postgres sentry -c "SELECT app, name FROM django_migrations ORDER BY id DESC LIMIT 5"`
- Time the cold start: `time docker compose -f docker/sandbox/docker-compose.sandbox.yml up --wait`

### 1.9 Estimated Effort

2-3 weeks for one engineer. Bulk of time is iterating on Dockerfile.postgres (getting migrations to run headless inside a build is fiddly — Sentry expects a running Postgres, so the multi-stage approach with a tmpfs Postgres is the main challenge).

---

## Phase 2: Agent Sandbox Runtime

### Goal
Provide an environment where AI agents can execute pytest, pre-commit, and other tools against the Sentry codebase with Postgres + Redis available, supporting iterative workflows.

### 2.1 Where Should Agent Sandboxes Run?

**Recommendation: GKE pods with a warm pool**

| Option | Cold Start | Cost | Ops Complexity | Verdict |
|--------|-----------|------|----------------|---------|
| **GKE pods** | ~10-15s (warm pool: ~2s) | Pay-per-use, autoscale to 0 | Medium (you already have GKE) | **Recommended** |
| GCE instances | ~30-60s | Always-on cost or slow cold start | Low | Good for dev envs, overkill for agents |
| Modal | ~5-10s | Per-second billing | Low (managed) | Vendor lock-in, no Docker Compose |
| GitHub Actions | ~30-60s | Free for public repos | Low | No persistent state, poor for iterative |

**Why GKE**: Sentry already runs on GCP. GKE provides:
- Pod-level isolation (each agent gets its own pod with sidecar containers)
- Warm pool via pre-scaled deployments (keep N pods ready)
- Autoscaling to zero when idle
- Native GHCR image pulling with GCP artifact registry mirroring
- Resource limits (`requests`/`limits`) for CPU, memory
- Network policies for security isolation

### 2.2 Docker Compose Sidecar Setup

**File**: `docker/sandbox/docker-compose.sandbox.yml`

```yaml
services:
  agent:
    image: ghcr.io/getsentry/sentry-agent:nightly
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      - SENTRY_SKIP_SERVICE_VALIDATION=1
      - DATABASE_URL=postgres://postgres@postgres:5432/sentry
      - SENTRY_POSTGRES_HOST=postgres
      - SENTRY_REDIS_HOST=redis
    working_dir: /usr/src/sentry
    volumes:
      # Mount workspace for agent to write patches/results
      - workspace:/workspace
    # Keep alive for iterative workflows
    command: ["sleep", "infinity"]
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G

  postgres:
    image: ghcr.io/getsentry/sentry-postgres:nightly
    environment:
      - POSTGRES_HOST_AUTH_METHOD=trust
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 2s
      timeout: 5s
      retries: 10
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
    # Use tmpfs for speed — data doesn't need to persist between sandbox runs
    tmpfs:
      - /var/lib/postgresql/data:size=2G

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 2s
      timeout: 5s
      retries: 10
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G

volumes:
  workspace:
```

**Key decisions**:
- Postgres on `tmpfs` — databases are pre-migrated in the image, data is disposable per sandbox session. This makes Postgres significantly faster.
- `sleep infinity` on agent container — keeps it alive for iterative agent workflows (exec commands into it).
- No Kafka/Snuba/Clickhouse — 88-92% of backend tests only need Postgres + Redis.

### 2.3 GKE Pod Specification

For GKE deployment, the Docker Compose translates to a Kubernetes Pod spec with sidecar containers:

**File**: `docker/sandbox/k8s/sandbox-pod.yaml`

```yaml
apiVersion: v1
kind: Pod
metadata:
  labels:
    app: sentry-sandbox
spec:
  containers:
    - name: agent
      image: ghcr.io/getsentry/sentry-agent:nightly
      command: ["sleep", "infinity"]
      resources:
        requests: { cpu: "2", memory: "4Gi" }
        limits: { cpu: "4", memory: "8Gi" }
      env:
        - name: SENTRY_SKIP_SERVICE_VALIDATION
          value: "1"
        - name: SENTRY_POSTGRES_HOST
          value: "localhost"  # sidecar containers share localhost
        - name: SENTRY_REDIS_HOST
          value: "localhost"

    - name: postgres
      image: ghcr.io/getsentry/sentry-postgres:nightly
      env:
        - name: POSTGRES_HOST_AUTH_METHOD
          value: "trust"
      resources:
        requests: { cpu: "1", memory: "2Gi" }
        limits: { cpu: "2", memory: "4Gi" }
      readinessProbe:
        exec:
          command: ["pg_isready", "-U", "postgres"]
        periodSeconds: 2

    - name: redis
      image: redis:7-alpine
      resources:
        requests: { cpu: "500m", memory: "512Mi" }
        limits: { cpu: "1", memory: "1Gi" }
      readinessProbe:
        exec:
          command: ["redis-cli", "ping"]
        periodSeconds: 2

  # Pod-level timeout — kill sandbox after 30 minutes
  activeDeadlineSeconds: 1800
  restartPolicy: Never
```

### 2.4 Warm Pool Strategy

Maintain a pool of pre-created sandbox pods that are ready to accept work:

```
Warm Pool Controller (CronJob or custom controller):
  - Maintains N=5 idle sandbox pods (configurable)
  - When an agent claims a pod, controller creates a replacement
  - Pods expire after 30 minutes (activeDeadlineSeconds)
  - Scale to 0 idle pods during off-hours (nights/weekends)
```

**Cold start breakdown with warm pool**:
| Step | Without Warm Pool | With Warm Pool |
|------|-------------------|----------------|
| Pull images | 10-30s (cached: 0s) | Pre-pulled |
| Start Postgres | 5-10s (initdb restore) | Already running |
| Start Redis | 1-2s | Already running |
| Agent ready | 1-2s | Already running |
| **Total** | **17-44s** | **~2s** (just claim the pod) |

### 2.5 How Agents Submit Work

**Recommendation: `kubectl exec` via an API gateway**

The agent harness (Phase 3) calls a lightweight API that:
1. Claims an available sandbox pod from the warm pool
2. Applies the agent's code changes (git patch or file sync)
3. Executes commands via `kubectl exec` into the agent container
4. Streams stdout/stderr back
5. Returns the pod to the pool (or destroys it) when done

This avoids SSH setup, custom daemons, or workflow dispatch latency. `kubectl exec` is effectively the same as `docker exec` but over the Kubernetes API.

### 2.6 Iterative Workflow Support

Agents keep the sandbox alive across multiple commands:

```
Agent Session:
  1. claim_sandbox() → sandbox_id
  2. apply_patch(sandbox_id, patch) → ok
  3. exec(sandbox_id, "pytest -x tests/sentry/api/test_base.py") → output
  4. apply_patch(sandbox_id, fix_patch) → ok
  5. exec(sandbox_id, "pytest -x tests/sentry/api/test_base.py") → output
  6. exec(sandbox_id, "pre-commit run --files src/sentry/api/base.py") → output
  7. release_sandbox(sandbox_id) → ok
```

The sandbox retains all state (database, filesystem changes, pytest cache with `--reuse-db`) between commands in a session.

### 2.7 Security Considerations

- **Network isolation**: Sandbox pods can only reach Postgres/Redis sidecars (localhost). No outbound internet access. NetworkPolicy enforces this.
- **Resource limits**: CPU and memory caps prevent runaway processes.
- **Time limits**: `activeDeadlineSeconds` kills sandbox after 30 minutes.
- **Read-only codebase**: Agent container's `/usr/src/sentry` is read-only. Agent writes to `/workspace` overlay.
- **No privileged containers**: No Docker-in-Docker, no host mounts.
- **Pod-level isolation**: Each agent gets its own pod. No shared state between sandboxes.

### 2.8 Files to Create

```
docker/sandbox/
├── docker-compose.sandbox.yml
├── k8s/
│   ├── sandbox-pod.yaml
│   ├── warm-pool-controller.yaml
│   └── network-policy.yaml
```

### 2.9 Risks & Open Questions

1. **Image pull latency**: GHCR→GKE pull can be slow. Mitigate with GCP Artifact Registry mirroring or image pre-pulling via DaemonSet.
2. **Postgres tmpfs size**: Pre-migrated databases are small (~50 MB), but tests create data. 2 GB tmpfs should be sufficient. Monitor and adjust.
3. **~8-12% of tests need Snuba/Kafka**: If agents need to run these tests, the sandbox needs additional sidecars. Consider a "full" sandbox variant with more services, provisioned on-demand only.
4. **Warm pool cost**: 5 idle pods × (4 CPU + 8 GB) = 20 CPU + 40 GB always reserved. At GKE pricing ~$3-5/day. Scale down off-hours.

### 2.10 Validation

- Run `docker compose -f docker/sandbox/docker-compose.sandbox.yml up -d` locally
- `docker compose exec agent pytest --co -q tests/sentry/api/test_base.py` → tests collect successfully
- `docker compose exec agent pytest -x -svv --reuse-db tests/sentry/api/test_base.py` → tests pass
- `docker compose exec agent pre-commit run --files src/sentry/api/base.py` → linting works
- Time end-to-end: `time docker compose up --wait` → target <15 seconds

### 2.11 Estimated Effort

3-4 weeks for one engineer. Main work is the GKE pod lifecycle management and warm pool controller. Docker Compose version works first (week 1-2), GKE version after (week 3-4).

---

## Phase 3: Agent Harness / SDK

### Goal
Provide a Python SDK and CLI that wraps the sandbox lifecycle, making it easy for AI agents to create sandboxes, run commands, and retrieve results.

### 3.1 SDK Design

**File**: `tools/sandbox/sdk.py` (or published as `sentry-sandbox` package)

```python
from __future__ import annotations

import subprocess
import json
import time
from dataclasses import dataclass
from pathlib import Path


@dataclass
class ExecResult:
    exit_code: int
    stdout: str
    stderr: str
    duration_seconds: float


class SandboxSession:
    """Manages a sandbox lifecycle for running commands against Sentry."""

    def __init__(self, sandbox_id: str, backend: SandboxBackend):
        self.sandbox_id = sandbox_id
        self._backend = backend

    def exec(self, command: str | list[str], timeout: int = 300) -> ExecResult:
        """Execute a command in the sandbox."""
        ...

    def apply_patch(self, patch: str) -> ExecResult:
        """Apply a git-format patch to the codebase."""
        return self.exec(["git", "apply", "--stat", "-"], stdin=patch)

    def write_file(self, path: str, content: str) -> ExecResult:
        """Write a file in the sandbox."""
        ...

    def read_file(self, path: str) -> str:
        """Read a file from the sandbox."""
        ...

    def run_tests(
        self,
        test_files: list[str] | None = None,
        changed_files: list[str] | None = None,
        pytest_args: str = "",
    ) -> ExecResult:
        """Run pytest, optionally with selective testing."""
        if changed_files and not test_files:
            # Use selective testing to determine which tests to run
            test_files = self._compute_selected_tests(changed_files)

        cmd = ["python3", "-b", "-m", "pytest", "--reuse-db", "-svv"]
        if test_files:
            cmd.extend(test_files)
        else:
            cmd.extend([
                "tests",
                "--ignore", "tests/acceptance",
                "--ignore", "tests/apidocs",
                "--ignore", "tests/js",
                "--ignore", "tests/tools",
            ])

        return self.exec(cmd)

    def run_lint(self, files: list[str]) -> ExecResult:
        """Run pre-commit on specific files."""
        return self.exec(["pre-commit", "run", "--files"] + files)

    def run_typecheck(self) -> ExecResult:
        """Run mypy type checking."""
        return self.exec(["python3", "-m", "mypy", "src/sentry"])

    def _compute_selected_tests(self, changed_files: list[str]) -> list[str]:
        """Use the selective testing infrastructure to find affected tests."""
        result = self.exec([
            "python3",
            ".github/workflows/scripts/selective-testing/compute-selected-tests.py",
            "--coverage-db", ".cache/coverage.db",
            "--changed-files", " ".join(changed_files),
            "--output", ".cache/selected-tests.txt",
        ])
        if result.exit_code != 0:
            return []  # Fall back to full suite

        read_result = self.read_file(".cache/selected-tests.txt")
        return [l.strip() for l in read_result.splitlines() if l.strip()]

    def destroy(self) -> None:
        """Release the sandbox."""
        self._backend.destroy(self.sandbox_id)


class SandboxBackend:
    """Abstract backend for sandbox provisioning."""

    def create(self, image_tag: str = "nightly") -> str:
        """Create a sandbox, return its ID."""
        ...

    def exec(self, sandbox_id: str, command: list[str],
             timeout: int = 300, stdin: str | None = None) -> ExecResult:
        ...

    def destroy(self, sandbox_id: str) -> None:
        ...


class DockerComposeBackend(SandboxBackend):
    """Local Docker Compose backend for development/testing."""

    def create(self, image_tag: str = "nightly") -> str:
        project_name = f"sandbox-{int(time.time())}"
        subprocess.run([
            "docker", "compose",
            "-f", "docker/sandbox/docker-compose.sandbox.yml",
            "-p", project_name,
            "up", "-d", "--wait",
        ], check=True)
        return project_name

    def exec(self, sandbox_id: str, command: list[str],
             timeout: int = 300, stdin: str | None = None) -> ExecResult:
        start = time.monotonic()
        proc = subprocess.run(
            ["docker", "compose", "-p", sandbox_id,
             "exec", "-T", "agent"] + command,
            capture_output=True, text=True, timeout=timeout,
            input=stdin,
        )
        return ExecResult(
            exit_code=proc.returncode,
            stdout=proc.stdout,
            stderr=proc.stderr,
            duration_seconds=time.monotonic() - start,
        )

    def destroy(self, sandbox_id: str) -> None:
        subprocess.run([
            "docker", "compose", "-p", sandbox_id,
            "down", "-v", "--remove-orphans",
        ], check=True)


class KubernetesBackend(SandboxBackend):
    """GKE backend that claims pods from the warm pool."""
    ...
```

### 3.2 CLI Wrapper

**File**: `tools/sandbox/cli.py`

```python
"""CLI for sandbox management.

Usage:
    python -m tools.sandbox create [--tag nightly]
    python -m tools.sandbox exec <sandbox-id> -- pytest -x tests/sentry/api/test_base.py
    python -m tools.sandbox test <sandbox-id> --files tests/sentry/api/test_base.py
    python -m tools.sandbox lint <sandbox-id> --files src/sentry/api/base.py
    python -m tools.sandbox destroy <sandbox-id>
"""
```

### 3.3 Changed Files → Test Files Mapping

The SDK reuses the existing selective testing infrastructure (PR #108052):

1. **Coverage DB**: Pre-baked into the agent image from the latest nightly coverage run, or fetched at sandbox creation via `fetch-coverage.py`
2. **compute-selected-tests.py**: Already exists, maps changed source files → affected test files via the coverage database
3. **Integration**: `SandboxSession.run_tests(changed_files=["src/sentry/api/base.py"])` automatically computes and runs only affected tests

### 3.4 Task Type Support

| Task | Command | Timeout |
|------|---------|---------|
| Run tests | `pytest --reuse-db -svv [files]` | 300s |
| Run specific test | `pytest --reuse-db -svv -k test_name [file]` | 120s |
| Run linter | `pre-commit run --files [files]` | 120s |
| Run type checker | `mypy src/sentry` | 600s |
| Run selective tests | Compute selected → pytest | 300s |

### 3.5 Files to Create

```
tools/sandbox/
├── __init__.py
├── sdk.py          # SandboxSession, backends
├── cli.py          # CLI entrypoint
├── backends/
│   ├── __init__.py
│   ├── docker.py   # DockerComposeBackend
│   └── k8s.py      # KubernetesBackend
└── tests/
    ├── test_sdk.py
    └── test_cli.py
```

### 3.6 Risks & Open Questions

1. **Coverage DB freshness**: The coverage DB in the agent image is from the nightly build. If a developer adds new source files during the day, the selective testing won't know about them until the next nightly build. Mitigation: `run_tests` falls back to running directly-changed test files even without coverage data (existing behavior in `compute-selected-tests.py`).
2. **Exec latency**: `docker exec` has ~50-100ms overhead per command. `kubectl exec` is similar. For iterative agent workflows with many small commands, consider batching.
3. **Stdout/stderr size**: Test output can be very large. Consider truncation or streaming.

### 3.7 Validation

- Unit tests for SDK with mock backend
- Integration test: `create → apply_patch → run_tests → destroy` end-to-end
- Benchmark: time from `create()` to first test result

### 3.8 Estimated Effort

2-3 weeks. The Docker Compose backend is straightforward (week 1). The Kubernetes backend requires more work (week 2-3). The CLI is a thin wrapper.

---

## Phase 4: Developer Environments

### Goal
Leverage the pre-built images from Phase 1 to dramatically reduce developer onboarding time and optionally provide remote dev environments.

### 4.1 Faster Local `devenv sync`

**Approach**: Modify `devenv sync` to restore from pre-built images instead of building from scratch.

**File**: Modify `devenv/sync.py` to add a fast-path:

```python
def fast_sync_from_images(reporoot: str, venv_dir: str) -> bool:
    """Try to restore venv and databases from pre-built images.
    Returns True if successful, False to fall back to normal sync."""

    # 1. Check if sentry-agent image is available and matches current uv.lock
    agent_tag = f"uv-{hash_file(f'{reporoot}/uv.lock')}"
    if not docker_image_exists(f"ghcr.io/getsentry/sentry-agent:{agent_tag}"):
        return False

    # 2. Extract .venv from agent image (faster than uv sync)
    print("⏳ Restoring Python dependencies from pre-built image...")
    subprocess.run([
        "docker", "run", "--rm",
        "-v", f"{venv_dir}:/.venv-target",
        f"ghcr.io/getsentry/sentry-agent:{agent_tag}",
        "cp", "-a", "/.venv/.", "/.venv-target/",
    ], check=True)

    # 3. Use pre-migrated postgres image for devservices
    print("⏳ Starting pre-migrated databases...")
    # Override the postgres image in devservices config
    ...

    return True
```

This is the highest-leverage Phase 4 optimization: replacing the ~60s `uv sync` and ~60-120s migration steps with image pulls that are cached after the first run.

### 4.2 Delta Migration Support

When the pre-built Postgres image is slightly behind (e.g., a new migration was added today but the image is from last night):

```python
def apply_delta_migrations(reporoot: str) -> None:
    """Run only migrations that aren't in the pre-built image."""
    # The pre-migrated image records the last applied migration per app
    # Just run `sentry upgrade --noinput` — Django is smart enough to
    # only apply unapplied migrations
    subprocess.run(["sentry", "upgrade", "--noinput"], check=True)
```

Django's migration framework already handles this: `sentry upgrade` checks `django_migrations` table and only runs new ones. If the image has 260 of 266 migrations, only 6 run (~5 seconds instead of 120).

### 4.3 Remote Dev Environment Evaluation

| Platform | Docker-in-Docker | Hot Reload | Cost/Dev/Month | Onboarding | Verdict |
|----------|-------------------|------------|----------------|------------|---------|
| **GitHub Codespaces** | Yes (DinD) | VS Code Remote | ~$40-80 | Low (`.devcontainer.json`) | **Best for quick start** |
| **GCP Cloud Workstations** | Yes (Docker Desktop) | VS Code/JetBrains | ~$50-100 | Medium | Good GCP integration |
| **Self-hosted on GCE** | Yes (full VM) | Any IDE + SSH | ~$30-60 | High | Most flexible, most ops |
| **Coder** (on GKE) | Yes (sysbox) | Any IDE | ~$20-40 + infra | Medium | Good if you want self-hosted |

**Recommendation: GitHub Codespaces for most developers, with pre-built images**

Codespaces supports Docker-in-Docker (devservices needs this), has VS Code integration, and `.devcontainer.json` can reference the pre-built images:

**File**: `.devcontainer/devcontainer.json`

```json
{
  "name": "Sentry Dev",
  "image": "ghcr.io/getsentry/sentry-agent:nightly",
  "features": {
    "ghcr.io/devcontainers/features/docker-in-docker:2": {},
    "ghcr.io/devcontainers/features/node:1": { "version": "22" }
  },
  "postCreateCommand": "devenv sync",
  "forwardPorts": [8000, 8080],
  "customizations": {
    "vscode": {
      "extensions": [
        "ms-python.python",
        "ms-python.mypy-type-checker",
        "dbaeumer.vscode-eslint"
      ]
    }
  }
}
```

The `sentry-agent:nightly` image already has Python deps installed. The `postCreateCommand` runs `devenv sync` which detects existing venv and only does incremental work (JS deps, devservices, delta migrations).

### 4.4 Files to Create/Modify

```
.devcontainer/
├── devcontainer.json

devenv/
├── sync.py                  # Modified: add fast-path image restore

docker/sandbox/
├── (already created in Phase 1)
```

### 4.5 Risks & Open Questions

1. **Codespaces cost**: For a large team, Codespaces at $40-80/dev/month adds up. The pre-built images pay for themselves by reducing compute time (less CPU time per setup).
2. **Docker-in-Docker reliability**: Devservices uses Docker Compose extensively. DinD in Codespaces works but can be flaky with complex networking. Test thoroughly.
3. **Hot reload performance**: VS Code Remote over network has latency. For frontend work, consider running the webpack dev server on the remote and port-forwarding.
4. **Image staleness**: If a developer starts a Codespace on Monday and doesn't rebuild by Friday, their base image is stale. Codespaces supports "rebuild" but it's manual.

### 4.6 Validation

- Create a Codespace from `.devcontainer.json`, time the full setup
- Run `make test-selective` in the Codespace
- Verify hot reload works: edit a Python file, see the change reflected
- Measure cold start improvement: current (3-5 min) vs. with pre-built images (target: <60s)

### 4.7 Estimated Effort

2-3 weeks. The `devcontainer.json` is quick. The `devenv sync` fast-path requires careful integration testing. Remote dev evaluation is mostly experimentation and documentation.

---

## Phase Dependencies

```
Phase 1 ──────────┬──→ Phase 2 ──→ Phase 3
(Images)          │    (Runtime)    (SDK)
                  │
                  └──→ Phase 4
                       (Dev Envs)
```

- **Phase 1 is a prerequisite for all other phases**
- Phase 2 depends on Phase 1 (needs the images)
- Phase 3 depends on Phase 2 (needs the runtime to talk to)
- Phase 4 depends on Phase 1 only (independent of Phase 2/3)
- **Phase 4 can run in parallel with Phase 2+3**

## Standalone Value Per Phase

| Phase | Standalone Value |
|-------|-----------------|
| 1 | Faster CI (image caching), faster local setup (pull vs. build), reproducible environments |
| 2 | Manual agent use (create sandbox, exec commands, destroy). Useful for ad-hoc testing. |
| 3 | Programmatic agent integration. Enables automated workflows: PR review bots, test generation, bug fixing agents. |
| 4 | Faster developer onboarding. Remote dev option. Reduced "works on my machine" issues. |

## Total Estimated Effort

| Phase | Effort | Cumulative |
|-------|--------|------------|
| Phase 1 | 2-3 weeks | 2-3 weeks |
| Phase 2 | 3-4 weeks | 5-7 weeks |
| Phase 3 | 2-3 weeks | 7-10 weeks |
| Phase 4 | 2-3 weeks | 7-10 weeks (parallel with 2+3) |

One engineer, ~10 weeks total with Phase 4 running parallel to Phase 2+3.
