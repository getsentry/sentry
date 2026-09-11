# Sentry Development Guide for AI Agents

> **IMPORTANT**: AGENTS.md files are the source of truth for AI agent instructions. Always update the relevant AGENTS.md file when adding or modifying agent guidance. Do not add to CLAUDE.md or Cursor rules.

## Command Execution Guide

Critical command instructions that apply across all Sentry development.

### Python Command Execution Requirements

**CRITICAL**: Python commands (pytest, mypy, prek, etc.) MUST run in the virtualenv. Prefix the full relative path, or source the activate script:

```bash
cd /path/to/sentry && .venv/bin/pytest tests/...
cd /path/to/sentry && source .venv/bin/activate && pytest tests/...
```

For AI agents: always use `required_permissions: ['all']` for Python commands to avoid sandbox permission issues.

### Backend Development Commands

#### Setup

```bash
# Refreshes dependencies. SENTRY_DEVENV_FRONTEND_ONLY=1 skips migrations
# (not needed for pytest). HIGHLY RECOMMENDED.
SENTRY_DEVENV_FRONTEND_ONLY=1 devenv sync

# Refresh dependencies AND apply migrations (only for a working dev server).
devenv sync

direnv allow    # activate the environment
devservices up  # bring up services
```

That is all that is required to run `pytest`. `devservices serve` starts the development server. For full environment setup/troubleshooting, use the **`setup-dev`** skill.

When the devserver runs, its full console output is teed to `.artifacts/dev.log` (ANSI-stripped, gitignored, truncated per process start; override with `SENTRY_DEV_LOG_FILE`). Agents can't see the devserver terminal — `tail`/`grep` this file to inspect startup, reloads, request logs, and tracebacks. Dev-only.

#### Linting

prek is the single entrypoint for all lint, format, and type-checking tools. Before considering a task complete, run `.venv/bin/prek run -q` (detects changed files automatically). To run a specific hook:

```bash
SENTRY_MYPY_PRE_PUSH=1 .venv/bin/prek run -q mypy --files src/sentry/foo/bar.py --stage pre-push
.venv/bin/prek run -q ruff --files src/sentry/foo/bar.py
```

If a hook fails, fix the issues, stage changes, then re-run until it passes.

#### Testing

For backend-scoped changes, prioritize running the individual relevant pytest files or nodeids locally. `make test-selective` is not optimized for routine local development, so use it only when useful for a particular investigation. If a PR's backend CI fails, inspect the `select-tests` job in `.github/workflows/backend.yml` and its selected-test output to identify the exact nodeids CI ran, then run those locally.

```bash
# Run a specific test file. Do not run pytest by itself; it'll take forever!
.venv/bin/pytest -n3 -svv --reuse-db tests/sentry/api/test_base.py
```

#### Database Operations

Creating/applying migrations and resolving rebase conflicts (`makemigrations`, `django migrate`, `update-migration`) → use the **`generate-migration`** skill. To reset the database (`make reset-db`) or other environment tasks → use the **`setup-dev`** skill.

### Frontend Development Commands

#### Development Setup

```bash
pnpm run dev     # full dev server (requires devservices up)
pnpm run dev-ui  # UI-only with hot reload; proxies API to production sentry.io
```

Dev server URLs: full devserver `http://dev.getsentry.net:8000`; frontend-only `https://sentry.dev.getsentry.net:7999/`.

#### Typechecking

Run the `pnpm run typecheck` script. It checks the whole project and does not accept file paths. DO NOT use `tsc` directly.

#### Linting

```bash
pnpm run lint:js                          # all JS/TS
pnpm run lint:js components/avatar.tsx    # specific file(s)
pnpm run fix                              # auto-fix
```

#### Testing

```bash
pnpm test-ci <file_path>                       # run tests
pnpm test-ci components/avatar.spec.tsx        # specific file(s)
```

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

## Feature Flags (FlagPole)

New features should be gated behind a flag: register in `src/sentry/features/temporary.py`, check with `features.has(...)` (Python) or `organization.features.includes(...)` (frontend). For the full workflow (registration, `api_expose`, tests, rollout) → use the **`feature-flags`** skill, or see https://develop.sentry.dev/feature-flags/. Deleting a finished flag or option requires a fixed PR order across sentry and sentry-options-automator → use the **`remove-option-or-flag`** skill.

## Redis TTLs

**Every new Redis key sets a TTL, or is registered with Infrastructure Engineering as accepted durable data.** `CommonRedisCache.set` and `RedisKVStorage.set` raise `MissingTTL` rather than write a key with no expiry. There is no opt-out argument: the exemption is granted by Infrastructure Engineering, not at the callsite.

Two things a "does this write set an expiry?" review will miss. A bare `SET`, `GETSET` or `SETEX` over an existing key clears the TTL it already had, while `SADD`, `ZADD`, `HSET`, `HINCRBY` and `INCR` leave it alone. And a TTL refreshed on every write is not a bound — shard by time window and give each shard a fixed TTL instead. Full rules: https://develop.sentry.dev/backend/application-domains/redis/.

## Customer Information

**Never include customer information in pull requests, commits, or code.** This covers organization slugs, user emails, account names, internal IDs tied to specific customers, support ticket details, and any other data that identifies a Sentry customer. Use anonymized or synthetic examples (`org-slug`, `user@example.com`) in PR descriptions, commit messages, code comments, tests, and fixtures. If a real identifier is needed for debugging, keep it in internal tooling (Slack, tickets, private notes)—not in the public git history.

## Pull Requests

Frontend (`static/`) and backend (`src/`, `tests/`) are **not atomically deployed**. A CI check enforces this.

- If your changes touch both frontend and backend, split them into **separate PRs**.
- Land the backend PR first when the frontend depends on new API changes.
- Pure test additions alongside `src/` changes are fine in one PR.
