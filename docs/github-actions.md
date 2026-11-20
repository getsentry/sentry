# GitHub Actions scripting

How to write the logic behind a step in `.github/workflows/`. These rules apply to new and changed steps. Existing workflows move to them as they're touched, so you don't need to rewrite a whole file to fix one step.

## Where logic goes

| Logic                                                                                 | Put it in                                                                     |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| One command with literal arguments, such as `make api-baseline` or `pnpm run lint:js` | inline `run:`                                                                 |
| Anything that calls the GitHub API, such as commits, refs, PRs, comments, or checks   | `actions/github-script`, importing a module from `.github/workflows/scripts/` |
| Other logic that `github-script` can't do well, such as reading Python tooling output | a Python 3 script in `.github/workflows/scripts/`, standard library only      |
| Anything else                                                                         | not shell. Move it to one of the rows above                                   |

- Prefer `actions/github-script` over Python. Use Python only when the step really needs it.
- Add no new dependencies. `github-script` provides Octokit (`github`), the event `context`, and `core`. Python scripts import only the standard library.
- Don't add new `.sh` scripts or multi-line `run:` shell. When you change a step that already runs shell, move its logic to `github-script` or Python in the same PR.

## `actions/github-script`

- Don't pin commit SHAs by hand. Write the version tag in `uses:` and run [`gh actions-lock`](https://github.com/github/gh-actions-lock), which pins every action to a verified commit in `.github/workflows/actions.lock`. Rerun it after you change any `uses:`, and commit the lockfile with the workflow.
- Keep the inline `script:` to an import and a call. The logic lives in `.github/workflows/scripts/<name>.ts`:

  ```yaml
  - uses: actions/github-script@v9.0.0
    with:
      script: |
        const {syncStoriesPreviewComment} = await import(
          `${process.env.GITHUB_WORKSPACE}/.github/workflows/scripts/stories-preview-comment.ts`
        );
        await syncStoriesPreviewComment({github, context, core});
  ```

- Write modules in TypeScript and export one function that takes `{github, context, core, ...inputs}`. Node runs them by stripping types, so use only erasable syntax: no `enum`, `namespace`, or constructor parameter properties, and import with the `.ts` extension.
- Type the Octokit calls you use in a local interface, because `@actions/github` isn't a dependency, as `stories-preview-comment.ts` does.
- Pass inputs through `env:` and read them from `process.env`. Don't put `${{ }}` expressions in `script:`, because they're templated into the code before it runs.
- Use Octokit, not `gh` or `git push`. To commit to a bot branch, use the Git Data API (`git.createTree`, `git.createCommit`, `git.updateRef`). That needs no git identity, and GitHub signs the commit as the app.
- Fail with a thrown error or `core.setFailed`, and log with `core.info`. Don't swallow API errors. Catch only the status you expect, such as a 422 for a ref that doesn't exist yet, and rethrow everything else.

## Python scripts

- Use `#!/usr/bin/env python3` and the standard library only (`json`, `argparse`, `subprocess`, `urllib.request`).
- Take inputs as arguments or env vars, and exit non-zero on failure.
- Call it as one command per step, such as `python3 .github/workflows/scripts/<name>.py`.

## Tests

| Script      | Test file                                                              | Run by                                                                                  |
| ----------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `<name>.ts` | `<name>.test.ts` next to it, with `node:test` and `node:assert/strict` | `node --test .github/workflows/scripts/*.test.{js,ts}` in `development-environment.yml` |
| `<name>.py` | `test_<name>.py` next to it                                            | `make test-tools`                                                                       |

- Mock `github` with plain objects that record their calls, and assert on the API calls the script makes for each path: the no-op, the first run, an existing branch or PR, and invalid input.

## Least privilege and zizmor

prek runs [zizmor](https://docs.zizmor.sh) offline on every changed workflow, with `.github/zizmor.yml`. Fix findings in your diff instead of ignoring them.

| zizmor audit              | Rule                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `excessive-permissions`   | `permissions: contents: read` at the top of the workflow, and a `permissions:` block on each job with only the scopes it uses |
| `artipacked`              | `persist-credentials: false` on checkout, unless the job pushes, fetches, or calls an action that needs the token on disk     |
| `github-app`              | `permission-*` inputs on every `actions/create-github-app-token`                                                              |
| `overprovisioned-secrets` | Name each secret. `secrets[matrix.name]` loads every repository secret into the runner                                        |
| `template-injection`      | No `${{ }}` in `run:` or `script:`. Pass values through `env:`                                                                |
| `dangerous-triggers`      | A `pull_request_target`, `workflow_run`, or `issue_comment` workflow never checks out or runs PR code                         |

- Give a write token only to the job that writes. Scan or build in a separate read-only job, hand the result over as an artifact, and validate it before acting on it.
- Ignore a finding only for an intentional design, in `.github/zizmor.yml` with a written reason. Use an inline `# zizmor: ignore[<audit>]` comment when a config entry would match too broadly, such as every `action.yml`.
- PR CI doesn't run jobs that only run after merge, such as scheduled, release, or `pull_request_target` jobs. When you change their permissions, name them in the PR body. Narrow permissions one workflow per PR, so each can be reverted alone.
