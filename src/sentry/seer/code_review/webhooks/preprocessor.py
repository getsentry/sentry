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

from ..utils import _transform_webhook_to_codegen_request
from .check_run import preprocess_check_run_event

logger = logging.getLogger(__name__)

METRICS_PREFIX = "seer.code_review.webhook"


def preprocess_other_webhook_event(
    *,
    event_type: str,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    **kwargs: Any,
) -> None:
    """
    Each webhook event type may implement its own preprocessor.
    This is a generic preprocessor for non-PR-related events (e.g., issue_comment on regular issues).
    """
    from ..webhook_task import process_github_webhook_event

    event_type_enum = EventType.from_string(event_type)
    transformed_event = _transform_webhook_to_codegen_request(
        event_type_enum, dict(event), organization.id
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


# Type check to ensure the function matches WebhookProcessor protocol
_only_for_type_checking: WebhookProcessor = preprocess_other_webhook_event


EVENT_TYPE_TO_PREPROCESSOR = {
    EventType.CHECK_RUN: preprocess_check_run_event,
    EventType.ISSUE_COMMENT: preprocess_other_webhook_event,
    EventType.PULL_REQUEST: preprocess_other_webhook_event,
    EventType.PULL_REQUEST_REVIEW: preprocess_other_webhook_event,
    EventType.PULL_REQUEST_REVIEW_COMMENT: preprocess_other_webhook_event,
}


def preprocess_webhook_event(
    *,
    event_type: str,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    **kwargs: Any,
) -> None:
    """
    Preprocess GitHub webhook events.

    Args:
        event_type: The type of the webhook event (as string)
        event: The webhook event payload
        **kwargs: Additional keyword arguments including organization (Organization), repo, integration
    """
    organization = kwargs.get("organization")
    assert organization is not None

    event_type_enum = EventType.from_string(event_type)
    preprocessor = EVENT_TYPE_TO_PREPROCESSOR.get(event_type_enum)
    if preprocessor is None:
        # This should not happen, but we report to Sentry without blocking a release
        logger.warning(
            "github.webhook.preprocessor.not_found",
            extra={"event_type": event_type},
        )
        return

    preprocessor(event_type=event_type, event=event, organization=organization, **kwargs)


# Type check to ensure the function matches WebhookProcessor protocol
_type_checked_preprocess_webhook_event: WebhookProcessor = preprocess_webhook_event
