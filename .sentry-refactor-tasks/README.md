# `.sentry-refactor-tasks`

Config for the [**`@sentry/refactor-tasks`**](https://github.com/getsentry/sentry-refactor-tasks)
convention scanner as it runs against **this** repo. For how the tool works —
commands, the convention schema, inference backends, caching, spike protection —
see the [upstream README](https://github.com/getsentry/sentry-refactor-tasks/blob/main/README.md).

## What's here

```
.sentry-refactor-tasks/
└── conventions/
    ├── <name>.yaml           # one rule each
    ├── <name>.detect.sh      # optional sidecar detector for a rule
    └── oxlint-json-runner.ts # shared helper for oxlint-backed detectors
```

Run `pnpm dlx @sentry/refactor-tasks list` to see the configured conventions.
Most use the LLM path (`detect` + `prefilter`). Oxlint conventions have one YAML
per lint rule and share `no-deprecated-callsite.detect.sh` and
`oxlint-json-runner.ts`. Add a YAML with the rule ID and an explicit
`SENTRY_OXLINT_TYPEAWARE` setting instead of copying a detector script.

The shared runner imports the repository's oxlint config and writes a unique,
temporary single-rule config. It preserves rule options and override contexts,
including explicit `off` overrides. It disables unrelated rule categories and
unused-disable reporting. Type-aware rules such as `typescript/no-deprecated`
need `SENTRY_OXLINT_TYPEAWARE=true`; the Scraps rule uses `false`.

Lint enforcement can coexist with migration debt. `--baseline` selects files
from `oxlint-suppressions.json` for the selected rule, including tests. The
counts select files only. Live oxlint diagnostics supply each finding's line
and message. The runner invokes the repository's native oxlint CLI from a
temporary working directory so native suppressions do not hide findings; it
never edits the baseline. Inline disables and configured overrides still apply.
An empty selection reports no findings. Invalid baseline data or incomplete
lint runs fail the scan.

Without `--baseline`, the runner scans production TypeScript under `static/`,
excluding tests, fixtures, mocks, and configured ignores. The deprecated rule
reports only messages with a migration instruction after "is deprecated."
The scanner retains its default issue grouping.

Run the shared detector checks with:

```bash
node --test .sentry-refactor-tasks/conventions/oxlint-json-runner.test.ts
```

All rules target the frontend (`static/`). To add a Python rule, point a new
convention's `include`/`prefilter` at `src/sentry/**/*.py` instead — the scanner
is language-agnostic, so each file sets its own scope.

## Running it

Install the repository dependencies with `pnpm install --frozen-lockfile` first.
The scheduled workflow installs them before scanning; detectors do not install
or change dependencies.

Against this repo, from the root:

```bash
pnpm dlx @sentry/refactor-tasks scan-and-report
```

Reporting needs `SENTRY_DSN` (and an inference backend — an `OPENROUTER_API_KEY`,
or an authenticated local `claude` CLI). Drop `-and-report` to scan locally with
no DSN while iterating on a rule.

## Scheduled scan

[`.github/workflows/refactor-tasks.yml`](../.github/workflows/refactor-tasks.yml)
runs the scan daily, on manual dispatch, and on pushes to `master` that touch
`conventions/`. It supplies the settings that would otherwise be env vars:

- `SENTRY_DSN` ← `SENTRY_REFACTOR_TASKS_DSN` secret (the project findings land in).
- `OPENROUTER_API_KEY` ← `REFACTOR_TASKS_OPENROUTER_API_KEY` secret.

Both are repository secrets and must exist for the workflow to report.
