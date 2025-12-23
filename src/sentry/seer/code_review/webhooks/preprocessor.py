from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from sentry.models.organization import Organization
from sentry.seer.code_review.webhooks.types import EventType
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.integrations.github.webhook import WebhookProcessor

from ..utils import _transform_webhook_to_codegen_request
from .check_run import preprocess_check_run_event

METRICS_PREFIX = "seer.code_review.webhook"


def preprocess_other_webhook_event(
    *, event_type: str, event: Mapping[str, Any], organization: Organization, **kwargs: Any
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


EVENT_TYPE_TO_PREPROCESSOR = {
    EventType.CHECK_RUN: preprocess_check_run_event,
    EventType.ISSUE_COMMENT: preprocess_other_webhook_event,
    EventType.PULL_REQUEST: preprocess_other_webhook_event,
    EventType.PULL_REQUEST_REVIEW: preprocess_other_webhook_event,
    EventType.PULL_REQUEST_REVIEW_COMMENT: preprocess_other_webhook_event,
}


def preprocess_webhook_event(*, event_type: str, event: Mapping[str, Any], **kwargs: Any) -> None:
    """
    Preprocess GitHub webhook events.

    Args:
        event_type: The type of the webhook event (as string)
        event: The webhook event payload
        **kwargs: Additional keyword arguments including organization (Organization), repo, integration
    """
    # XXX: We can fix the signature once we fix the _handle() signature in the GitHub webhook handler.
    # This is added by the GitHub webhook handler to the kwargs.
    organization = kwargs.get("organization")
    assert organization is not None

    event_type_enum = EventType.from_string(event_type)
    preprocessor = EVENT_TYPE_TO_PREPROCESSOR.get(event_type_enum)
    if preprocessor is None:
        return

    preprocessor(event_type=event_type, event=event, organization=organization, **kwargs)


# Type check to ensure the function matches WebhookProcessor protocol
_: WebhookProcessor = preprocess_webhook_event
