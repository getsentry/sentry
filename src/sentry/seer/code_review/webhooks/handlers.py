from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.integrations.github.webhook import WebhookProcessor

from ..utils import _transform_webhook_to_codegen_request
from .check_run import handle_check_run_event

logger = logging.getLogger(__name__)

METRICS_PREFIX = "seer.code_review.webhook"


def handle_other_webhook_event(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    **kwargs: Any,
) -> None:
    """
    Each webhook event type may implement its own handler.
    This is a generic handler for non-PR-related events (e.g., issue_comment on regular issues).
    """
    from .task import process_github_webhook_event

    transformed_event = _transform_webhook_to_codegen_request(
        github_event, dict(event), organization.id, repo
    )

    if transformed_event is None:
        metrics.incr(
            f"{METRICS_PREFIX}.{github_event.value}.skipped",
            tags={"reason": "failed_to_transform", "github_event": github_event.value},
        )
        return

    process_github_webhook_event.delay(
        github_event=github_event,
        event_payload=transformed_event,
        enqueued_at_str=datetime.now(timezone.utc).isoformat(),
    )
    metrics.incr(
        f"{METRICS_PREFIX}.{github_event.value}.enqueued",
        tags={"status": "success", "github_event": github_event.value},
    )


EVENT_TYPE_TO_handler: dict[GithubWebhookType, WebhookProcessor] = {
    GithubWebhookType.CHECK_RUN: handle_check_run_event,
    GithubWebhookType.ISSUE_COMMENT: handle_other_webhook_event,
    GithubWebhookType.PULL_REQUEST: handle_other_webhook_event,
    GithubWebhookType.PULL_REQUEST_REVIEW: handle_other_webhook_event,
    GithubWebhookType.PULL_REQUEST_REVIEW_COMMENT: handle_other_webhook_event,
}


def handle_webhook_event(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    **kwargs: Any,
) -> None:
    """
    Handle GitHub webhook events.

    Args:
        github_event: The GitHub webhook event type from X-GitHub-Event header (e.g., "check_run", "pull_request")
        event: The webhook event payload
        organization: The Sentry organization that the webhook event belongs to
        repo: The repository that the webhook event is for
        **kwargs: Additional keyword arguments including integration
    """
    handler = EVENT_TYPE_TO_handler.get(github_event)
    if handler is None:
        logger.warning(
            "github.webhook.handler.not_found",
            extra={"github_event": github_event.value},
        )
        return

    handler(
        github_event=github_event,
        event=event,
        organization=organization,
        repo=repo,
        **kwargs,
    )


# Type checks to ensure the functions match WebhookProcessor protocol
_type_checked_handle_other_webhook_event: WebhookProcessor = handle_other_webhook_event
_type_checked_handle_check_run_event: WebhookProcessor = handle_check_run_event
