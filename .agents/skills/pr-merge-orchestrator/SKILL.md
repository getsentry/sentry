---
name: pr-merge-orchestrator
description: Keep a pull request merge-ready by triaging feedback, resolving clear merge conflicts, and delegating CI stabilization to iterate-pr. Use when a PR is blocked by conflicts plus checks/review churn, or when the user asks to make a PR mergeable end-to-end.
---

# PR Merge Orchestrator

Get a PR to merge-ready state by handling conflicts first, then running the CI/review loop.

## Scope

Use this as the top-level workflow when a PR is not mergeable because of:

- merge conflicts
- failing checks
- unresolved review feedback

## Workflow

1. Identify PR and current branch (`gh pr view --json number,url,headRefName,mergeStateStatus`).
2. Triage review feedback (including review bots):
   - Address high/medium items.
   - Ask user before acting on low/nit-only feedback.
3. Resolve merge conflicts:
   - Sync with base branch.
   - Auto-resolve only when intent is clearly equivalent.
   - If conflict intent is ambiguous, stop and ask the user.
4. Delegate CI stabilization to `iterate-pr`:
   - Pass PR number and branch name.
   - Let `iterate-pr` run the fix/push/monitor loop until checks settle.
5. Re-check mergeability:
   - If new conflicts appear, return to step 3.
   - If mergeable but high/medium feedback appears, return to step 2.
6. Exit when PR is mergeable, checks are green, and blocking feedback is cleared.

## Delegation Contract

### Hand-off to iterate-pr

Provide:

- PR number
- branch name
- current blockers already handled (conflicts resolved, feedback triaged)

Request back:

- final check status
- remaining blocking feedback (if any)
- whether branch stayed conflict-free

### Return conditions from iterate-pr

`iterate-pr` should return control immediately if:

- merge conflicts reappear
- branch needs rebase/sync before more CI work
- failures require product or owner clarification

## Safety Rules

- Do not resolve ambiguous semantic conflicts without user confirmation.
- Keep fixes small and scoped.
- Verify affected tests/lints locally before pushing when practical.
- Do not force-push unless the user explicitly asks for it.

## Authorship Transparency

When posting PR comments via `gh` using a human user's credentials, explicitly disclose that the comment was posted by an AI agent.

- Add a short footer to agent-authored comments, for example:
  - `Posted by Cursor AI agent using @<github-login> credentials.`
- Prefer a dedicated bot/app token for automation comments when available.
- Operational trigger comments (for example `@sentry review`) can be left without the footer if brevity is preferred.
