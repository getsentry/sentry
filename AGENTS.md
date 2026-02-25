# Sentry Development Guide for AI Agents

> **IMPORTANT**: AGENTS.md files are the source of truth for AI agent instructions. Always update the relevant AGENTS.md file when adding or modifying agent guidance. Do not add to CLAUDE.md or Cursor rules.

## Overview

Sentry is a developer-first error tracking and performance monitoring platform. This repository contains the main Sentry application, which is a large-scale Django application with a React frontend.

## Project Structure

```
sentry/
├── src/
│   ├── sentry/           # Main Django application
│   │   ├── api/          # REST API endpoints
│   │   ├── models/       # Django models
│   │   ├── tasks/        # Celery tasks
│   │   ├── integrations/ # Third-party integrations
│   │   ├── issues/       # Issue tracking logic
│   │   └── web/          # Web views and middleware
│   ├── sentry_plugins/   # Plugin system
│   └── social_auth/      # Social authentication
├── static/               # Frontend application
├── tests/                # Backend test suite
├── fixtures/             # Test fixtures
├── devenv/               # Development environment config
├── migrations/           # Database migrations
└── config/               # Configuration files
```

## Command Execution Guide

This section contains critical command execution instructions that apply across all Sentry development.

### Python Command Execution Requirements

**CRITICAL**: When running Python commands (pytest, mypy, pre-commit, etc.), you MUST use the virtual environment.

#### For AI Agents (automated commands)

Use the full relative path to virtualenv executables:

```bash
cd /path/to/sentry && .venv/bin/pytest tests/...
cd /path/to/sentry && .venv/bin/python -m mypy ...
```

Or source the activate script in your command:

```bash
cd /path/to/sentry && source .venv/bin/activate && pytest tests/...
```

**Important for AI agents:**

- Always use `required_permissions: ['all']` when running Python commands to avoid sandbox permission issues
- The `.venv/bin/` prefix ensures you're using the correct Python interpreter and dependencies

### Backend Development Commands

#### Setup

```bash
# Install dependencies and setup development environment
make develop

# Or use the newer devenv command
devenv sync

# Activate the Python virtual environment (required for running tests and Python commands)
direnv allow

# Start dev dependencies
devservices up

# Start the development server
devservices serve
```

#### Linting

```bash
# Preferred: Run pre-commit hooks on specific files
pre-commit run --files src/sentry/path/to/file.py

# Run all pre-commit hooks
pre-commit run --all-files
```

#### Testing

```bash
# Run Python tests (always use these parameters)
pytest -svv --reuse-db

# Run specific test file
pytest -svv --reuse-db tests/sentry/api/test_base.py
```

#### Database Operations

```bash
# Run migrations
sentry django migrate

# Create new migration
sentry django makemigrations

# Update migration after rebase conflict (handles renaming, dependencies, lockfile)
./bin/update-migration <migration_name_or_number> <app_label>
# Example: ./bin/update-migration 0101_workflow_when_condition_group_unique workflow_engine

# Reset database
make reset-db
```

### Frontend Development Commands

#### Development Setup

```bash
# Start the development server
pnpm run dev

# Start only the UI development server with hot reload
pnpm run dev-ui
```

#### Typechecking

Typechecking only works on the entire project. Individual files cannot be checked.

```bash
pnpm run typecheck
```

#### Linting

```bash
# JavaScript/TypeScript linting
pnpm run lint:js

# Linting for specific file(s)
pnpm run lint:js components/avatar.tsx [...other files]

# Fix linting issues
pnpm run fix
```

#### Testing

```bash
# Run JavaScript tests (always use CI flag)
CI=true pnpm test <file_path>

# Run specific test file(s)
CI=true pnpm test components/avatar.spec.tsx
```

> For detailed development patterns, see nested AGENTS.md files:
>
> - **Backend patterns**: `src/AGENTS.md`
> - **Backend testing patterns**: `tests/AGENTS.md`
> - **Frontend patterns**: `static/AGENTS.md`

### Context-Aware Loading

Cursor is configured to automatically load relevant AGENTS.md files based on the file being edited (via `.cursor/rules/*.mdc`). This provides context-specific guidance without token bloat:

- Editing `src/**/*.py` → Loads `src/AGENTS.md` (backend patterns)
- Editing `tests/**/*.py` → Loads `tests/AGENTS.md` (testing patterns)
- Editing `static/**/*.{ts,tsx,js,jsx}` → Loads `static/AGENTS.md` (frontend patterns)
- Always loads this file (`AGENTS.md`) for general Sentry context

**Note**: These `.mdc` files only _reference_ AGENTS.md files—they don't duplicate content. All actual guidance should be added to the appropriate AGENTS.md file, not to Cursor rules.

## Backend

For backend development patterns, security guidelines, and architecture, see `src/AGENTS.md`.
For backend testing patterns and best practices, see `tests/AGENTS.md`.

## Frontend

For frontend development patterns, design system guidelines, and React testing best practices, see `static/AGENTS.md`.

## Feature Flags (FlagPole)

New features should be gated behind a feature flag.

1. **Register** the flag in `src/sentry/features/temporary.py`:

   ```python
   manager.add("organizations:my-feature", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
   ```

   Use `api_expose=True` if the frontend needs to check the flag. Use `ProjectFeature` and a `projects:` prefix for project-scoped flags.

2. **Python check**:

   ```python
   if features.has("organizations:my-feature", organization, actor=user):
   ```

3. **Frontend check** (requires `api_expose=True`):

   ```typescript
   organization.features.includes('my-feature');
   ```

4. **Tests**:

   ```python
   with self.feature("organizations:my-feature"):
       ...
   ```

5. **Rollout**: FlagPole YAML config lives in the `sentry-options-automator` repo, not here.

See https://develop.sentry.dev/feature-flags/ for full docs.

## Pull Requests

Frontend (`static/`) and backend (`src/`, `tests/`) are **not atomically deployed**. A CI check enforces this.

- If your changes touch both frontend and backend, split them into **separate PRs**.
- Land the backend PR first when the frontend depends on new API changes.
- Pure test additions alongside `src/` changes are fine in one PR.

## Cursor Cloud specific instructions

### Environment overview

The `devenv` CLI is macOS-only. On Cursor Cloud (Linux), dependencies are installed manually:

- **Python 3.13** via deadsnakes PPA, venv at `.venv/`
- **Node.js 22.16.0** via nvm
- **pnpm 10.30.2** via npm global install
- **uv** (Python package manager) at `~/.local/bin/uv`
- **Docker** for devservices (Postgres, Redis, Kafka/ClickHouse via Snuba, Relay, Spotlight)

### Starting services

```bash
# Ensure PATH includes all tools
export PATH="$HOME/.local/bin:$HOME/.nvm/versions/node/v22.16.0/bin:/workspace/.venv/bin:$PATH"
export VIRTUAL_ENV="/workspace/.venv"
export SENTRY_CONF="$HOME/.sentry"
export NODE_OPTIONS="--max-old-space-size=4096 --experimental-transform-types"

# Start Docker daemon (if not running)
sudo dockerd &>/tmp/dockerd.log &
sleep 5
sudo chmod 666 /var/run/docker.sock

# Start devservices (default mode: Postgres, Redis, Snuba, Relay, Spotlight)
devservices up --mode default

# Start the dev server (backend only, no watchers for faster startup)
sentry devserver 0.0.0.0:8000 --no-watchers &

# For frontend with hot reload, also run:
pnpm run dev-ui
```

### Gotchas

- **No `devenv sync` on Linux**: Run `uv sync --frozen --inexact --quiet --active` and `pnpm install --frozen-lockfile` manually instead.
- **`fast_editable` required**: After `uv sync`, run `.venv/bin/python -m tools.fast_editable --path .` to make `sentry` importable.
- **Docker socket permissions**: After starting `dockerd`, run `sudo chmod 666 /var/run/docker.sock`.
- **Kafka connection errors during `sentry upgrade`**: Expected when running in `migrations` mode (no Kafka). These are non-fatal warnings.
- **Frontend assets**: The devserver with `--no-watchers` serves pre-built assets. Either run `pnpm run build` once, or use `pnpm run dev-ui` alongside the devserver for hot reload.
- **Login credentials**: `admin@sentry.io` / `admin` (created via `sentry createuser --superuser`).
- **Backend tests**: Use `pytest -svv --reuse-db` (no `--timeout` flag; it's not a recognized argument).
- **Frontend tests**: Always use `CI=true pnpm test <file>` to prevent watch mode.
- **Pre-commit hooks**: If `core.hooksPath` is set, unset it first: `git config --unset-all core.hooksPath`.
