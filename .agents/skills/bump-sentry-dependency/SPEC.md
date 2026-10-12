# Bump Sentry Dependency Specification

## Intent

Route existing Sentry Python dependency bumps through the repository's
self-serve GitHub workflow without treating a general bump request as permission
to start a job or open a PR.

## Scope

In scope:

- Existing direct Python dependencies in `getsentry/sentry`
- Read-only eligibility and duplicate checks
- Confirmed dispatch of `.github/workflows/bump-version.yml`
- Inspecting the generated PR and reporting its state
- Diagnosing internal-PyPI availability as a possible prerequisite

Out of scope:

- Adding a new dependency
- JavaScript or other package ecosystems
- Automatically approving or merging generated PRs
- Changing `getsentry/pypi` without separate explicit approval

## Users And Trigger Context

- Primary users: agents maintaining the Sentry repository
- Common requests: "bump sentry-sdk to 2.x", "update taskbroker-client", or
  "upgrade this Python dependency in Sentry"
- Should not trigger for: dependency explanations, JavaScript upgrades, package
  releases, or dependency changes in another repository

## Runtime Contract

- Verify eligibility and deduplicate before dispatch.
- Treat a general bump request as ambiguous about external side effects.
- Get explicit confirmation immediately before dispatch unless prior context
  explicitly authorizes running the workflow or opening its PR.
- Keep mirror changes, approval, auto-merge, and merge outside that confirmation.
- Report the generated PR and its current CI/review state without waiting for a
  human indefinitely.

## Source And Evidence Model

Authoritative implementation and operational evidence are recorded in
`SOURCES.md`. Do not store credentials, private workflow logs, customer data, or
other sensitive values in skill artifacts.

## Reference Architecture

- `SKILL.md` contains the complete runtime workflow.
- `SPEC.md` defines scope and maintenance expectations.
- `SOURCES.md` records provenance and durable decisions.
- No runtime references or scripts are required.

## Validation

- Run the Agent Skills structural validator.
- Verify should-trigger cases for existing Sentry Python dependency bumps.
- Verify should-not-trigger cases for informational requests, new dependencies,
  JavaScript packages, and other repositories.
- Recheck dispatch inputs, branch naming, PR creation, and merge protections when
  the workflow or repository rules change.

## Known Limitations

- GitHub normally returns the dispatched run URL, but older GitHub versions or
  an occasional empty dispatch response require filtered run-list lookup.
- Workflow behavior and merge protections can change; inspect current state.

## Maintenance Notes

Update the skill when workflow inputs, bot branch naming, the bump helper,
internal-PyPI publication, required merge gates, or GitHub CLI output fields
change.
