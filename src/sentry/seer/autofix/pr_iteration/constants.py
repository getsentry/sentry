"""Shared constants for Autofix PR-iteration features."""

# Automated CI iteration: a failing check suite sends Autofix back to fix it.
AUTOMATED_FLAG = "organizations:autofix-pr-iteration"
# Human-triggered iteration: the drawer feedback form, `@sentry` PR comments,
# and PR reviews.
MANUAL_FLAG = "organizations:autofix-pr-iteration-manual"
# Draft-on-create, CI-green undraft, and review-request. Undraft requires
# ``MarkPullRequestDraftStateProtocol`` which is GitHub-only today; other SCM
# providers skip as unsupported until they grow that capability.
REVIEW_REQUEST_FLAG = "organizations:autofix-pr-iteration-review-request"
# Assign a human and post a status comment once a Seer PR exhausts its CI-fix
# iteration cap.
CAP_ASSIGN_FLAG = "organizations:autofix-pr-iteration-cap-assign"

# Project-scoped umbrella flag. Required by every stage above, on top of that
# stage's own organization flag -- see ``pr_iteration.flags``.
PR_ITERATION_PROJECT_FLAG = "projects:autofix-pr-iteration"
