from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.seer.code_review.webhooks.types import EventType
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.integrations.github.webhook import WebhookProcessor

from ..permissions import has_code_review_enabled
from ..utils import _transform_webhook_to_codegen_request
from .check_run import handle_check_run_event
from .issue_comment import handle_issue_comment_event

logger = logging.getLogger(__name__)

METRICS_PREFIX = "seer.code_review.webhook"


def _forward_to_seer(
    event_type: str, event: Mapping[str, Any], organization: Organization, repo: Repository
) -> None:
    """Transform and forward a webhook event to Seer for processing."""
    from .task import process_github_webhook_event

    event_type_enum = EventType.from_string(event_type)
    transformed_event = _transform_webhook_to_codegen_request(
        event_type_enum, dict(event), organization.id, repo
    )

    if transformed_event is None:
        metrics.incr(
            f"{METRICS_PREFIX}.{event_type}.skipped",
            tags={"reason": "failed_to_transform", "event_type": event_type},
        )
        return

    process_github_webhook_event.delay(
        event_type=event_type,
        event_payload=transformed_event,
        enqueued_at_str=datetime.now(timezone.utc).isoformat(),
    )
    metrics.incr(
        f"{METRICS_PREFIX}.{event_type}.enqueued",
        tags={"status": "success", "event_type": event_type},
    )


def handle_other_webhook_event(
    *,
    event_type: str,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    **kwargs: Any,
) -> None:
    """Handle other webhook events (pull_request, pull_request_review, etc.)."""
    if not has_code_review_enabled(organization):
        return

    _forward_to_seer(event_type, event, organization, repo)


EVENT_TYPE_TO_handler: dict[EventType, WebhookProcessor] = {
    EventType.CHECK_RUN: handle_check_run_event,
    EventType.ISSUE_COMMENT: handle_issue_comment_event,
    EventType.PULL_REQUEST: handle_other_webhook_event,
    EventType.PULL_REQUEST_REVIEW: handle_other_webhook_event,
    EventType.PULL_REQUEST_REVIEW_COMMENT: handle_other_webhook_event,
}


def handle_webhook_event(
    *,
    event_type: str,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    **kwargs: Any,
) -> None:
    """
    Handle GitHub webhook events.

    Args:
        event_type: The type of the webhook event (as string)
        event: The webhook event payload
        organization: The Sentry organization that the webhook event belongs to
        repo: The repository that the webhook event is for
        **kwargs: Additional keyword arguments including integration
    """
    event_type_enum = EventType.from_string(event_type)
    handler = EVENT_TYPE_TO_handler.get(event_type_enum)
    if handler is None:
        logger.warning(
            "github.webhook.handler.not_found",
            extra={"event_type": event_type},
        )
        return

    handler(event_type=event_type, event=event, organization=organization, repo=repo, **kwargs)


# Type checks to ensure the functions match WebhookProcessor protocol
_type_checked_handle_issue_comment_event: WebhookProcessor = handle_issue_comment_event
_type_checked_handle_other_webhook_event: WebhookProcessor = handle_other_webhook_event
_type_checked_handle_check_run_event: WebhookProcessor = handle_check_run_event
