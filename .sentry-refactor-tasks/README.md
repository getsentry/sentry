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

Run `pnpm dlx @sentry/refactor-tasks list` to see the rules currently
configured. They mostly use the LLM path (`detect` + `prefilter`); a couple use
the lint path (`detect_command`). `no-deprecated-callsite` is the worked example
for the lint path: its `.detect.sh` writes a temporary single-rule oxlint config
and runs it through `oxlint-json-runner.ts` — copy it when adding another
`detect_command`-based rule. A lint-path rule only earns its place while the
repo's own `oxlint.config.ts` does not enforce it; once lint blocks new
violations, the scanner has nothing left to find.

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

## PR check

[`.github/workflows/refactor-tasks-prevention.yml`](../.github/workflows/refactor-tasks-prevention.yml)
judges each PR's patch instead of the whole codebase. It narrows a sparse
checkout of the merge commit to the files the PR adds lines to, copies in this
folder's conventions from `master`, then runs `scan`. The judge still reads each
changed file whole, but a finding is reported only when the patch adds a line
its snippet quotes, so violations the file already had are left to the
scheduled scan. Lint-path conventions (`detect_command`) are skipped there,
since they need the full tree.

The workflow runs on `pull_request_target`, so the conventions it applies and
the script that holds the OpenRouter key always come from `master`: a convention
change only takes effect on PRs once it is merged.

The check is not required yet: violations fail its step, but not the check.
