from sentry.integrations.github.webhook_types import GithubWebhookType

# Mapping of webhook types to their corresponding option keys
WEBHOOK_TYPE_TO_OPTION_KEY = {
    GithubWebhookType.ISSUE_COMMENT: "github.webhook.issue-comment",
    GithubWebhookType.PULL_REQUEST: "github.webhook.pr",
}
