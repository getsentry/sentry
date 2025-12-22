from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

from sentry.models.organization import Organization
from sentry.seer.code_review.webhooks.types import EventType
from sentry.utils import metrics

from ..utils import _transform_webhook_to_codegen_request
from ..webhook_task import process_github_webhook_event
from .check_run import preprocess_check_run_event

METRICS_PREFIX = "seer.code_review.webhook"


def preprocess_webhook_event(
    *, event_type: EventType, event: Mapping[str, Any], organization: Organization
) -> None:
    """
    Preprocess GitHub webhook events.

    Args:
        event_type: The type of the webhook event
        event: The webhook event payload
        organization: The Sentry organization
    """
    if event_type == EventType.CHECK_RUN:
        preprocess_check_run_event(event=event, organization=organization)
        return

    transformed_event = _transform_webhook_to_codegen_request(event_type, event)
    process_github_webhook_event.delay(
        event_type=event_type,
        event_payload=transformed_event,
        organization_id=organization.id,
        enqueued_at_str=datetime.now(timezone.utc).isoformat(),
    )
    metrics.incr(
        f"{METRICS_PREFIX}.{event_type}.enqueued",
        tags={"status": "success", "event_type": event_type},
    )
