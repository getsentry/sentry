# Sources

Captured 2026-09-17.

## Authoritative Sources

| Source                                          | Supports                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| `.github/workflows/bump-version.yml`            | Workflow inputs, bot branch and PR creation, and no-diff behavior   |
| `tools/bump_version.py`                         | Existing-dependency restriction, `uv add`, and resolver retries     |
| `pyproject.toml`                                | Python dependency groups and internal-PyPI policy                   |
| GitHub CLI v2.97 `pkg/cmd/workflow/run/run.go`  | Returned dispatch run details and the empty-response fallback       |
| `getsentry/pypi` `README.md` and build workflow | Separate reviewed process for publishing a missing internal package |

## Decisions

- Keep this Sentry-only workflow in `sentry/.agents/skills` as a self-contained
  skill rather than duplicating the workflow in a script.
- Treat workflow dispatch, mirror changes, review, and merge as separate external
  side effects with separate approval boundaries.
- Resolve an exact version before dispatch so the generated bot branch and PR
  can be identified deterministically.
- Distinguish an unavailable internal package from an incompatible dependency
  set; a mirror PR only addresses the former.

## Known Limitation

GitHub normally returns the dispatched run URL, but older GitHub versions or an
empty response require a filtered run-list lookup.
