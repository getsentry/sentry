# `.sentry-refactor-tasks`

This folder configures the [**`@sentry/refactor-tasks`**](https://github.com/getsentry/sentry-refactor-tasks)
convention scanner for the Sentry repo.

The scanner is an LLM-powered tool that walks the codebase looking for
code-convention violations, then reports each one to Sentry as an issue. From
there, [Seer](https://docs.sentry.io/product/ai-in-sentry/seer/) can pick the
issue up and open a fix pull request. Conventions are plain YAML files, so
adding a new rule never requires touching the scanner's code — you drop a file
in `conventions/` and it gets picked up.

## How this folder is wired to the tool

The scanner discovers its config by convention (no flags needed): it walks up
from the current directory to find this folder, then scans the repo's working
tree in place — it never clones or mutates it.

```
.sentry-refactor-tasks/
└── conventions/
    ├── <name>.yaml           # one file per convention/rule
    ├── <name>.detect.sh      # optional detector script for a convention
    └── eslint-json-runner.ts # shared helper used by eslint-backed detectors
```

The folder only needs a `conventions/` directory. Repo-level settings that used
to live in a `repo.yaml` file now come from the **environment** (or CLI flags) —
see [Settings](#settings) below.

### Convention files (`conventions/*.yaml`)

Each file describes one rule. Key fields:

| Field                 | Purpose                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `name`                | Unique kebab-case id. Match the filename.                                                                                |
| `severity`            | `error`, `warning`, or `info`.                                                                                           |
| `tags`                | Free-form labels for grouping (e.g. `react`, `migration`, `api`).                                                        |
| `why`                 | Human explanation of the rule; shown in the Sentry issue.                                                                |
| `detect`              | Natural-language instructions telling the LLM what to flag — and, importantly, what **not** to flag.                     |
| `fix`                 | Remediation guidance handed to Seer (before/after examples, gotchas).                                                    |
| `examples`            | Optional `bad`/`good` snippets that sharpen detection precision.                                                         |
| `include` / `exclude` | Glob patterns scoping which files are scanned.                                                                           |
| `prefilter`           | Optional shell command that lists candidate files cheaply (e.g. `grep -rl ...`) so the LLM only looks at likely matches. |
| `detect_command`      | Optional shell command that **replaces** the LLM with a deterministic detector (e.g. eslint).                            |

Both shell commands support these substitution tokens: `{repo_path}` (the repo
root being scanned) and `{convention_dir}` (this `conventions/` folder — use it
to reference sidecar scripts/configs that live next to the YAML).

## Settings

Repo-level settings come from the environment (or CLI flags). There is no
longer a `repo.yaml` file.

| Variable                           | Purpose                                                                                                          | Default                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `SENTRY_DSN`                       | DSN findings are reported to (or pass `--dsn`).                                                                  | _(required to report)_ |
| `INFERENCE_MODEL`                  | Model tier: `haiku` \| `sonnet` \| `opus` (or `-m/--model`).                                                     | `haiku`                |
| `SCAN_CONCURRENCY`                 | Parallel LLM batches.                                                                                            | `4`                    |
| `REFACTOR_TASKS_SENTRY_CHUNK_SIZE` | Findings per Sentry batch; `0` sends all at once (see [Spike protection](#spike-protection--chunked-reporting)). | `0`                    |

A DSN is only needed when reporting — `list`, `validate`, and `scan` run
without one. `scan-and-report` and `report` require `--dsn` or `SENTRY_DSN` and
error clearly if neither is set. The `owner/name` slug used for issue
permalinks is read from the checkout's git `origin` remote, so it isn't
configured here.

The DSN this repo reports to (the project that receives the issues) is wired
into the [scheduled workflow](../.github/workflows/refactor-tasks.yml) via the
`SENTRY_REFACTOR_TASKS_DSN` repository secret. To run locally, export
`SENTRY_DSN` yourself.

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

### Detection output (stdout shape)

The two paths read different things from the command's **stdout**. In both
cases, write any install/progress noise to **stderr** (e.g. `pnpm install …
1>&2`) so it doesn't corrupt stdout.

- **`prefilter` → a newline-separated list of absolute file paths.** Each line
  is one candidate file the LLM will then judge. Blank lines are ignored; no
  output (or a non-zero exit) means "no candidates". This is exactly what
  `grep -rl … {repo_path}/static/app/` prints.

- **`detect_command` → a JSON array of per-file results.** The LLM is skipped
  entirely. Each entry has an absolute `filePath` and a `messages` array; files
  with an empty `messages` array are ignored. Per message, `line` and `message`
  are required (`message` becomes the finding's explanation), `endLine` is
  optional (defaults to `line`), and `ruleId` is optional/informational. Print
  `[]` when there are no violations.

  ```json
  [
    {
      "filePath": "/abs/checkout/static/app/views/foo.tsx",
      "messages": [
        {
          "ruleId": "react-you-might-not-need-an-effect/no-derived-state",
          "message": "Avoid storing derived state. Instead, compute \"x\" during render",
          "line": 104,
          "endLine": 104
        }
      ]
    }
  ]
  ```

A worked example lives at `conventions/no-derived-state.detect.sh`.

## Inference backends

The LLM detection path can run against either backend. Selection is driven by
environment variables — no secrets live in config files or on the command line.

- **OpenRouter** ([openrouter.ai](https://openrouter.ai)) — set
  `OPENROUTER_API_KEY` and requests go over HTTPS to OpenRouter's
  OpenAI-compatible API. This is used automatically whenever the key is present.
- **Local `claude` CLI** — used when no OpenRouter key is set. Shells out to
  `claude --print`; relies on the binary's own authentication.

To force a backend regardless of what's set, use `INFERENCE_PROVIDER`
(`openrouter` or `claude-cli`).

| Variable                  | Purpose                                                          | Default                        |
| ------------------------- | ---------------------------------------------------------------- | ------------------------------ |
| `OPENROUTER_API_KEY`      | OpenRouter API key. Its presence enables the OpenRouter backend. | _(unset → use `claude` CLI)_   |
| `INFERENCE_PROVIDER`      | Force a backend: `openrouter` or `claude-cli`.                   | auto-detect from the key       |
| `OPENROUTER_BASE_URL`     | Override the OpenRouter API base URL.                            | `https://openrouter.ai/api/v1` |
| `OPENROUTER_MODEL_HAIKU`  | OpenRouter model ID the `haiku` tier maps to.                    | `anthropic/claude-3.5-haiku`   |
| `OPENROUTER_MODEL_SONNET` | OpenRouter model ID the `sonnet` tier maps to.                   | `anthropic/claude-sonnet-4`    |
| `OPENROUTER_MODEL_OPUS`   | OpenRouter model ID the `opus` tier maps to.                     | `anthropic/claude-opus-4`      |

The `INFERENCE_MODEL` env var and `-m/--model` flag take a tier
(`haiku`/`sonnet`/`opus`); for OpenRouter each tier maps to a model ID via the
table above. You can also pass a fully qualified OpenRouter model ID (e.g.
`-m anthropic/claude-opus-4`) to bypass the mapping.

## Running it

From the repo root:

```bash
pnpm refactor-tasks
```

That maps to `pnpm dlx @sentry/refactor-tasks scan-and-report` — it scans every
convention in this folder and reports findings to the `SENTRY_DSN` in one step.
`pnpm dlx` fetches the tool on demand, so there's nothing to install.

The underlying CLI also exposes finer-grained subcommands you can run via
`pnpm dlx @sentry/refactor-tasks <command>`:

| Command                 | What it does                                                            |
| ----------------------- | ----------------------------------------------------------------------- |
| `list`                  | Show the conventions configured for this repo.                          |
| `validate`              | Check convention files against the schema.                              |
| `scan [pattern]`        | Run the conventions and print findings locally (no reporting).          |
| `scan-and-report`       | Scan **and** send findings to Sentry (what `pnpm refactor-tasks` runs). |
| `report <results-file>` | Submit previously-saved findings JSON to Sentry.                        |
| `generate-commands`     | Use the LLM to draft `prefilter` commands for conventions.              |

Common options: `-C/--cwd <dir>`, `-m/--model <tier>`, `--dry-run` (scan),
`-p/--pattern <name>` (limit to one convention), `--dsn <dsn>`,
`--chunk-size <n>` (report), `-v/--verbose`.

Use `scan` while iterating on a new rule (fast, local, no noise in Sentry), and
`scan-and-report` once you're happy with the signal.

### Cache location

Scan results (keyed by file content hash) and generated prefilter commands are
cached at a stable, user-level path so they persist across runs — including
`npx`/`pnpm dlx`, whose package install is ephemeral:

```
$XDG_CACHE_HOME/sentry-refactor-tasks/    # if XDG_CACHE_HOME is set
~/.cache/sentry-refactor-tasks/           # otherwise
```

Entries are namespaced per repo (`<owner>-<repo>/`). To force a clean re-scan,
delete that directory.

### Spike protection & chunked reporting

A scan can surface thousands of findings, each reported as a separate Sentry
event. [Spike protection](https://docs.sentry.io/pricing/quotas/spike-protection/)
guards a project against sudden bursts of ingest — but that's exactly what a
large scan looks like, so with it **enabled**, Sentry rate-limits the burst and
**silently drops most events**.

`REFACTOR_TASKS_SENTRY_CHUNK_SIZE` controls this:

- A positive value sends findings in throttled chunks of that size, flushing
  after each, so a large scan stays under the rate limit and every finding
  lands. Start around `25` if you hit drops.
- `0` (the default) sends every finding in one batch. Fast, but only safe when
  the project has spike protection **disabled**.

During `scan-and-report`, findings **stream** to Sentry as each convention
finishes, so reporting overlaps with the rest of the scan. When chunking, the
pacing is tunable via `REFACTOR_TASKS_SENTRY_CHUNK_DELAY_MS` (default 1000) and
`REFACTOR_TASKS_SENTRY_FLUSH_TIMEOUT_MS` (default 30000).

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
