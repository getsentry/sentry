"""Shared constants for Autofix PR-iteration features."""

# Draft-on-create, CI-green undraft, and review-request. Undraft requires
# ``MarkPullRequestDraftStateProtocol`` which is GitHub-only today; other SCM
# providers skip as unsupported until they grow that capability.
REVIEW_REQUEST_FLAG = "organizations:autofix-pr-iteration-review-request"
