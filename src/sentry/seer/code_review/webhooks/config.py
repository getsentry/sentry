from sentry.integrations.github.webhook_types import GithubWebhookType

WHITELISTED_GITHUB_ORGS = {
    "sentry-ecosystem",  # on s4s2 & us
    "coding-workflows-s4s",  # on us
    "sentry-coding-workflows",  # on us
}

# Mapping of webhook types to their corresponding option keys
WEBHOOK_TYPE_TO_OPTION_KEY = {
    GithubWebhookType.ISSUE_COMMENT: "github.webhook.issue-comment",
    GithubWebhookType.PULL_REQUEST: "github.webhook.pr",
}
