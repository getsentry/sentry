from __future__ import annotations

import logging
from collections.abc import MutableMapping
from dataclasses import dataclass
from typing import Any

from sentry import options
from sentry.options.rollout import in_rollout_group
from sentry.services.eventstore import processing
from sentry.services.eventstore.processing.base import EventProcessingStore
from sentry.utils.services import LazyServiceWrapper

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EventPayloadTransport:
    inline: bool
    cache: bool


def _send_inline(event_id: str | None) -> bool:
    return event_id is not None and in_rollout_group("store.enable-inline-payloads", event_id)


def get_event_payload_transport(event_id: str) -> EventPayloadTransport:
    """Choose working-cache writes when an event enters the pipeline."""
    send_inline = _send_inline(event_id)
    return EventPayloadTransport(
        inline=send_inline,
        cache=not (send_inline and options.get("store.disable-processing-store")),
    )


def load_event_payload(
    data: MutableMapping[str, Any] | None,
    cache_key: str | None,
    processing_store: LazyServiceWrapper[EventProcessingStore],
) -> MutableMapping[str, Any] | None:
    """Load inline event data or fall back to the processing store."""
    if data is not None:
        if isinstance(data, MutableMapping) and data.get("event_id"):
            return data
        logger.error("event_payload.invalid_inline_payload")
    if cache_key is not None:
        return processing_store.get(cache_key)
    raise ValueError("An event payload or cache key is required")


def prepare_submit(
    data: MutableMapping[str, Any] | None,
    cache_key: str | None,
    event_id: str | None,
) -> tuple[MutableMapping[str, Any] | None, str | None]:
    """Prepare event data and its cache key for submission to the next task."""
    if data is None:
        return None, cache_key

    # Cache-key presence fixes the write policy for the event's entire pipeline.
    if cache_key:
        cache_key = processing.event_processing_store.store(data)

    send_inline = not cache_key or _send_inline(event_id or data["event_id"])
    return (data if send_inline else None), cache_key
