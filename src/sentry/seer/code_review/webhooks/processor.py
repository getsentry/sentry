"""
The main function here is called by the Celery task to process the webhook event.
It routes to the appropriate event-specific processor based on the event type.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from ..utils import SeerEndpoint, make_seer_request
from .check_run import process_check_run_event
from .types import EventType

logger = logging.getLogger(__name__)


def _process_other_webhook_event(
    *, event_type: str, event_payload: Mapping[str, Any], **kwargs: Any
) -> None:
    """
    XXX: This is a placeholder processor to send events to Seer.
    """
    assert event_type != EventType.CHECK_RUN
    assert event_payload is not None
    make_seer_request(path=SeerEndpoint.SENTRY_REQUEST.value, payload=event_payload)


EVENT_TYPE_TO_PROCESSOR = {
    EventType.CHECK_RUN: process_check_run_event,
    EventType.ISSUE_COMMENT: _process_other_webhook_event,
    EventType.PULL_REQUEST: _process_other_webhook_event,
    EventType.PULL_REQUEST_REVIEW: _process_other_webhook_event,
    EventType.PULL_REQUEST_REVIEW_COMMENT: _process_other_webhook_event,
}


def process_task_event(*, event_type: str, event_payload: Mapping[str, Any], **kwargs: Any) -> None:
    event_type_enum = EventType.from_string(event_type)
    processor = EVENT_TYPE_TO_PROCESSOR.get(event_type_enum)
    if processor is None:
        raise ValueError(f"No processor found for event type: {event_type}")
    processor(event_type=event_type, event_payload=event_payload, **kwargs)
