---
name: bump-sentry-dependency
description: Bumps an existing Python dependency in getsentry/sentry through the repository's self-serve GitHub Actions workflow. Use when asked to update, upgrade, or bump a Python package version in Sentry. Does not apply to new dependencies, JavaScript packages, or informational questions about dependency management.
---

# Bump a Sentry Python Dependency

For an existing Python dependency, prefer `.github/workflows/bump-version.yml`
over editing `pyproject.toml` and `uv.lock` locally. The workflow creates a
non-draft PR when it produces a diff; it does not approve or merge the PR.

Do not use this workflow for new dependencies, JavaScript packages, other
repositories, or informational questions.

## Preflight without side effects

Before asking for confirmation:

1. Confirm the package is in `[project].dependencies` or the `dev` dependency
   group in `pyproject.toml`.
2. Resolve the exact target version. If the user says `latest`, determine the
   intended stable version first.
3. Check for an existing PR from
   `bot/bump-version/<package>/<version>`. Reuse and report it instead of
   dispatching a duplicate.

## Require confirmation

Dispatching the workflow is an external side effect: it starts a GitHub Actions
job and normally opens a PR. A request such as "bump package X" is not by itself
explicit approval for those effects.

Unless the user already said to run the workflow or open the PR, ask and wait:

> This will dispatch Sentry's `bump-version` workflow and open a PR if it
> produces a change. Would you like me to run it?

Do not treat approval for this dispatch as approval to modify `getsentry/pypi`,
approve the PR, enable auto-merge, or merge it.

## Dispatch and report

After approval, run:

```bash
gh workflow run bump-version.yml \
  --repo getsentry/sentry \
  --field package=<package> \
  --field version=<version>
```

Omit `pr_options` unless the user explicitly requested it. Use the run URL/ID
returned by `gh workflow run` to monitor that exact run:

```bash
gh run watch <run-id> --repo getsentry/sentry --exit-status
```

GitHub can occasionally return no run details. Only then fall back to
`gh run list`, filtered by this workflow, `workflow_dispatch`, the authenticated
user, and the dispatch time.

If the run succeeds, find the PR by its bot branch. Verify that changed files
are limited to `pyproject.toml` and `uv.lock` and that the dependency changes are
expected, then report the run URL, PR URL, current CI state, and review state. Do
not wait indefinitely for human review. Never describe the dependency as landed
until the PR is merged.

If the run succeeds without a PR, inspect its log. No diff usually means the
repository already satisfies the requested version.

## Handle failures narrowly

```bash
gh run view <run-id> --repo getsentry/sentry --log-failed
```

The workflow retries resolver failures for roughly 20 minutes. After it fails,
distinguish a genuinely missing internal-PyPI release from a dependency conflict.
A mirror PR will not fix an incompatible dependency set.

Changing `getsentry/pypi` is a separate external side effect. Explain why it is
needed and get separate explicit approval before making that cross-repository
change.
