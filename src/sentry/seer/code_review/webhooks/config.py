from typing import TYPE_CHECKING

from sentry.integrations.github.webhook_types import GithubWebhookType

from .check_run import handle_check_run_event, process_check_run_task_event

if TYPE_CHECKING:
    from sentry.integrations.github.webhook import WebhookProcessor

# Mapping of GithubWebhookType to their corresponding option keys
WEBHOOK_TYPE_TO_OPTION = {
    GithubWebhookType.ISSUE_COMMENT: "github.webhook.issue-comment",
    GithubWebhookType.PULL_REQUEST: "github.webhook.pr",
    GithubWebhookType.PULL_REQUEST_REVIEW_COMMENT: "github.webhook.pr-review-comment",
    GithubWebhookType.PULL_REQUEST_REVIEW: "github.webhook.pr-review",
}

# Mapping of EventType to their corresponding option keys
EVENT_TYPE_TO_OPTION = {
    GithubWebhookType.ISSUE_COMMENT: "github.webhook.issue-comment",
    GithubWebhookType.PULL_REQUEST: "github.webhook.pr",
    GithubWebhookType.PULL_REQUEST_REVIEW_COMMENT: "github.webhook.pr-review-comment",
    GithubWebhookType.PULL_REQUEST_REVIEW: "github.webhook.pr-review",
}

# Custom handlers focus on validating the data and then scheduling a task to process the event.
EVENT_TYPE_TO_CUSTOM_HANDLER: dict[GithubWebhookType, "WebhookProcessor"] = {
    GithubWebhookType.CHECK_RUN: handle_check_run_event
}

# Processors focus on processing the event and forwarding it to Seer if applicable.
EVENT_TYPE_TO_PROCESSOR = {GithubWebhookType.CHECK_RUN: process_check_run_task_event}
