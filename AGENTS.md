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

**CRITICAL**: When running Python commands (pytest, mypy, prek, etc.), you MUST use the virtual environment.

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
# Refreshes dependencies.
# SENTRY_DEVENV_FRONTEND_ONLY=1 skips over migrations which is not needed for pytest. HIGHLY RECOMMENDED.
SENTRY_DEVENV_FRONTEND_ONLY=1 devenv sync

# refresh dependencies, apply migrations
# Only relevant if you want a working development server.
devenv sync

direnv allow    # activate the environment
devservices up  # bring up services
```

That is all that is required to run `pytest`.

`devservices serve` starts the development server.

#### Linting

prek is the single entrypoint for all lint, format, and type-checking tools.

Before considering a task complete, run:

```bash
cd /path/to/sentry && .venv/bin/prek run -q
```

prek detects changed files automatically. To run a specific hook:

```bash
.venv/bin/prek run -q mypy --files src/sentry/foo/bar.py
.venv/bin/prek run -q ruff --files src/sentry/foo/bar.py
```

If a hook fails, fix the issues, stage changes, then re-run until it passes.

#### Testing

For backend-scoped changes, always try `make test-selective` first. It detects which tests are affected by your local diff and runs only those, making the feedback loop much faster. Fall back to `pytest` when you need to run a specific file or `test-selective` doesn't cover your case.

```bash
# Run a specific test file.
# Do not run pytest by itself; it'll take forever!
.venv/bin/pytest -n3 -svv --reuse-db tests/sentry/api/test_base.py
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
# Start the full development server (requires devservices up)
pnpm run dev

# Start only the UI development server with hot reload
# Proxies API requests to production sentry.io
pnpm run dev-ui
```

**Dev server URLs:**

- Full devserver: http://dev.getsentry.net:8000
- Frontend-only (`dev-ui`): https://sentry.dev.getsentry.net:7999/

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

## Viewer/Organization Context

- Viewer identity is wired through the app via the `ViewerContext` contextvar; use `sentry.viewer_context.get_viewer_context()` instead of explicitly threading org/user identity when the current viewer is in scope.

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

## Customer Information

**Never include customer information in pull requests, commits, or code.** This covers organization slugs, user emails, account names, internal IDs tied to specific customers, support ticket details, and any other data that identifies a Sentry customer. Use anonymized or synthetic examples (`org-slug`, `user@example.com`) in PR descriptions, commit messages, code comments, tests, and fixtures. If a real identifier is needed for debugging, keep it in internal tooling (Slack, tickets, private notes)—not in the public git history.

## Pull Requests

Frontend (`static/`) and backend (`src/`, `tests/`) are **not atomically deployed**. A CI check enforces this.

- If your changes touch both frontend and backend, split them into **separate PRs**.
- Land the backend PR first when the frontend depends on new API changes.
- Pure test additions alongside `src/` changes are fine in one PR.
