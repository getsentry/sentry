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

#### Before completing a task

Before you consider a coding task complete, run pre-commit on any files you created or modified. Use the actual paths (e.g. `src/sentry/foo/bar.py`, `tests/sentry/foo/test_bar.py`, `static/app/components/foo.tsx`):

```bash
# From repo root; for automation use the venv
cd /path/to/sentry && .venv/bin/pre-commit run --files <file1> [file2 ...]
```

If pre-commit fails, fix the reported issues and run it again until it passes. Do not push with `--no-verify` to skip hooks—fix the issues and try again instead. Only then treat the task as done.

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
pnpm run dev:ui
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

### Git worktrees

Each worktree has its own `.venv`. When you create a new worktree with `git worktree add`, a post-checkout hook runs `devenv sync` in the new worktree to setup the dev environment. Otherwise run `devenv sync` once in the new worktree, then `direnv allow` to validate and activate the dev environment.

### Context-Aware Loading

Use the right AGENTS.md for the area you're working in:

- **Backend** (`src/**/*.py`) → `src/AGENTS.md` (backend patterns)
- **Tests** (`tests/**/*.py`, `src/**/tests/**/*.py`) → `tests/AGENTS.md` (testing patterns)
- **Frontend** (`static/**/*.{ts,tsx,js,jsx,css,scss}`) → `static/AGENTS.md` (frontend patterns)
- **General** → This file (`AGENTS.md`) for Sentry overview and commands

Workflow steering (commit, pre-commit, hybrid cloud, etc.) lives in **skills** (`.agents/skills/`). Attach or read the area `AGENTS.md` when working in that tree. Add or update guidance in the appropriate AGENTS.md or skill—do not duplicate long guidance in editor-specific rule files.

## Agent Skills

Skills under `.agents/skills/` should follow the same current-practice conventions as the rest of the repo:

- Prefer diff-first review workflows. When no explicit file or patch is provided, default to the current branch diff.
- Keep skill descriptions aligned with natural user requests like PR review, branch audit, and Warden follow-up.
- If a downstream review harness controls the final response shape, do not hardcode a competing output format in the skill. Specify required evidence instead.

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
