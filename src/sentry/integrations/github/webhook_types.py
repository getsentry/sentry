from enum import StrEnum

GITHUB_WEBHOOK_TYPE_HEADER = "HTTP_X_GITHUB_EVENT"
GITHUB_WEBHOOK_TYPE_HEADER_KEY = "X-GITHUB-EVENT"
GITHUB_INSTALLATION_TARGET_ID_HEADER = "X-GITHUB-HOOK-INSTALLATION-TARGET-ID"


class GithubWebhookType(StrEnum):
    INSTALLATION = "installation"
    INSTALLATION_REPOSITORIES = "installation_repositories"
    ISSUE = "issues"
    ISSUE_COMMENT = "issue_comment"
    PULL_REQUEST = "pull_request"
    PULL_REQUEST_REVIEW_COMMENT = "pull_request_review_comment"
    PULL_REQUEST_REVIEW = "pull_request_review"
    PUSH = "push"
