Create (or update) a Pull Request.

We use the GitHub CLI (`gh`) to manage pull requests.

If this branch does not already have a pull request, create one:

- If we're on the main branch, switch to a working branch.
- Commit our changes if we haven't already.

If we already have one:

- Verify our changes against the base branch and update the PR title and description to maintain accuracy.

We should never focus on a test plan in the PR, but rather a concise description of the changes (features, breaking changes, major bug fixes, and architectural changes). Only include changes if they're present. We're always contrasting against our base branch when we describe these changes.

Before creating the PR, check whether the diff mixes frontend (`static/`) and backend (`src/`, `tests/`) changes. If it does, split into two PRs — backend first if the frontend depends on new API changes. A CI check will reject mixed PRs.
