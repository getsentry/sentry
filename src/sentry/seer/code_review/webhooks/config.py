from sentry import options
from sentry.integrations.github.webhook_types import GithubWebhookType

# Mapping of webhook types to their corresponding option keys
WEBHOOK_TYPE_TO_OPTION_KEY = {
    GithubWebhookType.ISSUE_COMMENT: "github.webhook.issue-comment",
    GithubWebhookType.PULL_REQUEST: "github.webhook.pr",
}


def get_direct_to_seer_gh_orgs() -> list[str]:
    """
    Returns the list of GitHub org names that should always send directly to Seer.
    """
    return options.get("seer.code-review.direct-to-seer-enabled-gh-orgs") or []
