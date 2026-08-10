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
    └── eslint-json-runner.ts # shared helper for eslint-backed detectors
```

Run `pnpm dlx @sentry/refactor-tasks list` to see the rules currently
configured. They mostly use the LLM path (`detect` + `prefilter`); a couple use
the lint path (`detect_command`). `no-derived-state` is the worked example for
the lint path: its `.detect.sh` runs the `react-you-might-not-need-an-effect`
eslint plugin through `eslint-json-runner.ts`, restoring
`package.json`/`pnpm-lock.yaml` afterward so the working tree stays clean — copy
it when adding another `detect_command`-based rule.

All rules target the frontend (`static/`). To add a Python rule, point a new
convention's `include`/`prefilter` at `src/sentry/**/*.py` instead — the scanner
is language-agnostic, so each file sets its own scope.

## Running it

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
