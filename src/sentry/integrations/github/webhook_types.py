from enum import StrEnum

GITHUB_WEBHOOK_TYPE_HEADER = "HTTP_X_GITHUB_EVENT"


class GithubWebhookType(StrEnum):
    INSTALLATION = "installation"
    ISSUE = "issues"
    PULL_REQUEST = "pull_request"
    PUSH = "push"
