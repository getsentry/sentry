# `.sentry-refactor-tasks`

This folder configures the [**`@sentry/refactor-tasks`**](https://github.com/getsentry/sentry-refactor-tasks)
convention scanner for the Sentry repo.

The scanner is an LLM-powered tool that walks the codebase looking for
code-convention violations, then reports each one to Sentry as an issue. From
there, Seer can pick the issue up and open a fix pull request. Conventions are
plain YAML files, so adding a new rule never requires touching the scanner's
code — you drop a file in `conventions/` and it gets picked up.

## How this folder is wired to the tool

The scanner discovers its config by convention (no flags needed) from this
directory:

```
.sentry-refactor-tasks/
├── repo.yaml                 # repo-level settings (DSN, model, concurrency)
└── conventions/
    ├── <name>.yaml           # one file per convention/rule
    ├── <name>.detect.sh      # optional detector script for a convention
    └── eslint-json-runner.ts # shared helper used by eslint-backed detectors
```

### `repo.yaml`

Repo-wide settings shared by every convention:

| Field              | Purpose                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `sentry_dsn`       | Where findings are reported (the project that receives the issues).                                                      |
| `default_model`    | LLM used for the detection pass (`haiku` / `sonnet` / `opus`). Cheaper models are fine for narrow, well-specified rules. |
| `scan_concurrency` | How many files/batches are evaluated by the LLM in parallel.                                                             |

### Convention files (`conventions/*.yaml`)

Each file describes one rule. Key fields:

| Field                 | Purpose                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`                | Unique kebab-case id. Match the filename.                                                                                                        |
| `severity`            | `error`, `warning`, or `info`.                                                                                                                   |
| `tags`                | Free-form labels for grouping (e.g. `react`, `migration`, `api`).                                                                                |
| `why`                 | Human explanation of the rule; shown in the Sentry issue.                                                                                        |
| `detect`              | Natural-language instructions telling the LLM what to flag — and, importantly, what **not** to flag.                                             |
| `fix`                 | Remediation guidance handed to Seer (before/after examples, gotchas).                                                                            |
| `examples`            | Optional `bad`/`good` snippets that sharpen detection precision.                                                                                 |
| `include` / `exclude` | Glob patterns scoping which files are scanned.                                                                                                   |
| `prefilter`           | Optional shell command that lists candidate files cheaply (e.g. `grep -rl ...`) so the LLM only looks at likely matches. Supports `{repo_path}`. |
| `detect_command`      | Optional shell command that **replaces** the LLM with a deterministic detector (e.g. eslint). Supports `{repo_path}` and `{convention_dir}`.     |

## Two detection paths

A convention is evaluated one of two ways:

1. **LLM path** (`detect` + optional `prefilter`/`include`/`exclude`) — the
   prefilter/globs narrow the file set, then the model reads each candidate and
   decides whether it violates the rule using the `detect`/`examples` guidance.
   Results are cached by file-content hash, so re-scans are cheap.
   `no-callback-api-request` and `no-class-components` use this path.

2. **Lint path** (`detect_command`) — the command runs directly and emits
   violations as JSON, bypassing the LLM entirely for deterministic,
   line-accurate results. `no-derived-state` uses this path: its
   `no-derived-state.detect.sh` pins and runs an eslint plugin
   (`react-you-might-not-need-an-effect`) and pipes the output through the
   shared `eslint-json-runner.ts`. The script is careful to restore
   `package.json`/`pnpm-lock.yaml` so your working tree is left clean.

## Running it

From the repo root:

```bash
pnpm refactor-tasks
```

That maps to `pnpm dlx @sentry/refactor-tasks scan-and-report` — it scans every
convention in this folder and reports findings to the `sentry_dsn` in
`repo.yaml` in one step. `pnpm dlx` fetches the tool on demand, so there's
nothing to install.

The underlying CLI also exposes finer-grained subcommands you can run via
`pnpm dlx @sentry/refactor-tasks <command>`:

| Command             | What it does                                                            |
| ------------------- | ----------------------------------------------------------------------- |
| `list`              | Show the conventions configured for this repo.                          |
| `validate`          | Check `repo.yaml` and convention files against the schema.              |
| `scan`              | Run the conventions and print findings locally (no reporting).          |
| `scan-and-report`   | Scan **and** send findings to Sentry (what `pnpm refactor-tasks` runs). |
| `report`            | Submit previously-saved findings to Sentry.                             |
| `generate-commands` | Use the LLM to draft `prefilter` commands for conventions.              |

Use `scan` while iterating on a new rule (fast, local, no noise in Sentry), and
`scan-and-report` once you're happy with the signal.

## Scanning all JS **and** Python files

The scanner is language-agnostic — it only cares about the `include`/`exclude`
globs and `prefilter`/`detect_command` you give each convention. The current
conventions target the frontend, scoped to `static/`:

```yaml
include:
  - 'static/app/**/*.tsx'
  - 'static/app/**/*.ts'
exclude:
  - '**/__fixtures__/**'
  - '**/__mocks__/**'
  - '**/*.spec.*'
  - '**/*.test.*'
  - '**/test/**'
prefilter: "grep -rl --include='*.tsx' --include='*.ts' -E '...' {repo_path}/static/"
```

To cover **all** JS/TS, widen the globs (e.g. drop the `app/` segment, or add
other roots like `tests/js/`) and broaden the prefilter path to match.

To add a **Python** convention, write a new `conventions/<name>.yaml` that points
at the backend tree instead:

```yaml
name: my-python-convention
severity: warning
tags: [python, backend]
why: |
  ...why this matters...
detect: |
  ...what the LLM should flag, and what to skip...
fix: |
  ...remediation guidance for Seer...
include:
  - 'src/sentry/**/*.py'
exclude:
  - '**/tests/**'
  - '**/migrations/**'
prefilter: "grep -rl --include='*.py' -E 'your-pattern' {repo_path}/src/"
```

Mix and match per convention: a single repo can hold rules that scan `static/`
TypeScript, `src/` Python, or both — each file decides its own scope. For
deterministic Python rules you can use the lint path instead, pointing
`detect_command` at a tool like `ruff`/`flake8` (mirroring how
`no-derived-state` shells out to eslint).

## Adding a new convention — checklist

1. Create `conventions/<name>.yaml` with `name`, `severity`, `why`, `detect`,
   and `fix`.
2. Scope it with `include`/`exclude`, and add a `prefilter` so the LLM only
   reads likely matches (or a `detect_command` for a deterministic detector).
3. Add `examples.bad` / `examples.good` to tighten precision.
4. `pnpm dlx @sentry/refactor-tasks validate` to check the schema.
5. `pnpm dlx @sentry/refactor-tasks scan` to eyeball the findings locally.
6. When the signal looks right, `pnpm refactor-tasks` to scan and report.

## See also

- Upstream tool & full docs: https://github.com/getsentry/sentry-refactor-tasks
