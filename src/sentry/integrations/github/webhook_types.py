from __future__ import annotations

from enum import StrEnum

GITHUB_WEBHOOK_TYPE_HEADER = "HTTP_X_GITHUB_EVENT"
GITHUB_WEBHOOK_TYPE_HEADER_KEY = "X-GITHUB-EVENT"
GITHUB_INSTALLATION_TARGET_ID_HEADER = "X-GITHUB-HOOK-INSTALLATION-TARGET-ID"


# All implemented webhook types are listed here.
# Reference: https://docs.github.com/en/webhooks/webhook-events-and-payloads
class GithubWebhookType(StrEnum):
    CHECK_RUN = "check_run"
    INSTALLATION = "installation"
    INSTALLATION_REPOSITORIES = "installation_repositories"
    ISSUE = "issues"
    ISSUE_COMMENT = "issue_comment"
    PULL_REQUEST = "pull_request"
    PULL_REQUEST_REVIEW = "pull_request_review"
    PULL_REQUEST_REVIEW_COMMENT = "pull_request_review_comment"
    PUSH = "push"
