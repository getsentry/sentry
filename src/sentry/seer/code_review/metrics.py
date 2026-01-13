from enum import StrEnum

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.utils import metrics

from .preflight import PreflightDenialReason

# All code review webhook metrics use this prefix
METRICS_PREFIX = "seer.code_review"


class WebhookFilteredReason(StrEnum):
    """Webhook-specific reasons why a webhook was filtered out."""

    NOT_REVIEW_COMMAND = "not_review_command"  # issue_comment not @sentry review
    UNSUPPORTED_ACTION = (
        "unsupported_action"  # Not a supported action, e.g., check_run not rerequested
    )
    INVALID_PAYLOAD = "invalid_payload"  # Validation failed
    TRANSFORM_FAILED = "transform_failed"  # Couldn't build Seer payload
    OVERWATCH_ENABLED = "overwatch_enabled"  # Option set to route to Overwatch not Seer


CodeReviewFilteredReason = WebhookFilteredReason | PreflightDenialReason


class CodeReviewErrorType(StrEnum):
    """Types of errors that can occur in the code review pipeline."""

    # Shared errors
    MISSING_ACTION = "missing_action"

    # Errors from check_run webhook
    MISSING_ORGANIZATION = "missing_organization"
    CODE_REVIEW_NOT_ENABLED = "code_review_not_enabled"
    INVALID_PAYLOAD = "invalid_payload"

    # Errors from pull_request webhook
    MISSING_PULL_REQUEST = "missing_pull_request"
    UNSUPPORTED_ACTION = "unsupported_action"
    DRAFT_PR = "draft_pr"

    # Errors from issue_comment webhook
    MISSING_INTEGRATION = "missing_integration"
    REACTION_FAILED = "reaction_failed"

    # Generic task-level errors (for unexpected exceptions)
    TASK_EXCEPTION = "task_exception"


def _build_webhook_tags(
    github_event: GithubWebhookType, github_event_action: str
) -> dict[str, str]:
    return {"github_event": github_event.value, "github_event_action": github_event_action}


def record_webhook_received(
    github_event: GithubWebhookType,
    github_event_action: str,
) -> None:
    """
    Record that a webhook was received and entered the handler.

    This is the entry point metric for the processing funnel.

    Args:
        github_event: The GitHub webhook event type (e.g., check_run, issue_comment)
        github_event_action: The webhook action (e.g., created, rerequested, synchronize)
    """
    metrics.incr(
        f"{METRICS_PREFIX}.webhook.received",
        tags=_build_webhook_tags(github_event, github_event_action),
        sample_rate=1.0,
    )


def record_webhook_filtered(
    github_event: GithubWebhookType,
    github_event_action: str,
    reason: CodeReviewFilteredReason,
) -> None:
    """
    Record that a webhook was filtered out and not sent to seer.

    Use this when the webhook is intentionally not processed (e.g., feature
    not enabled, not a review command, wrong action type).

    Args:
        github_event: The GitHub webhook event type
        github_event_action: The webhook action (e.g., created, rerequested, synchronize)
        reason: Why the webhook was filtered
    """
    metrics.incr(
        f"{METRICS_PREFIX}.webhook.filtered",
        tags={**_build_webhook_tags(github_event, github_event_action), "reason": reason.value},
        sample_rate=1.0,
    )


def record_webhook_enqueued(
    github_event: GithubWebhookType,
    github_event_action: str,
) -> None:
    """
    Record that a task was successfully enqueued for processing.

    This indicates the webhook passed all validation and a Celery task
    was created to process it.

    Args:
        github_event: The GitHub webhook event type
        github_event_action: The webhook action (e.g., created, rerequested, synchronize)
    """
    metrics.incr(
        f"{METRICS_PREFIX}.webhook.enqueued",
        tags=_build_webhook_tags(github_event, github_event_action),
        sample_rate=1.0,
    )


def record_webhook_handler_error(
    github_event: GithubWebhookType,
    github_event_action: str,
    error_type: CodeReviewErrorType,
) -> None:
    """
    Record an error in the webhook handler stage.

    Args:
        github_event: The GitHub webhook event type
        github_event_action: The webhook action (e.g., created, rerequested, synchronize)
        error_type: Specific error identifier from CodeReviewErrorType enum
    """
    metrics.incr(
        f"{METRICS_PREFIX}.webhook.error",
        tags={
            **_build_webhook_tags(github_event, github_event_action),
            "error_type": error_type.value,
        },
        sample_rate=1.0,
    )
