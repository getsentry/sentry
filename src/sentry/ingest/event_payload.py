from __future__ import annotations

from collections.abc import MutableMapping
from dataclasses import dataclass
from typing import Any

from sentry import options
from sentry.options.rollout import in_rollout_group
from sentry.services.eventstore import processing
from sentry.services.eventstore.processing.base import EventProcessingStore
from sentry.utils.services import LazyServiceWrapper


@dataclass(frozen=True)
class EventPayloadTransport:
    send_inline: bool
    write_processing_store: bool


def get_event_payload_transport(event_id: str) -> EventPayloadTransport:
    """Choose working-cache writes when an event enters the pipeline."""
    send_inline = in_rollout_group("store.enable-inline-payloads", event_id)
    return EventPayloadTransport(
        send_inline=send_inline,
        write_processing_store=not (send_inline and options.get("store.disable-processing-store")),
    )


def load_event_payload(
    data: MutableMapping[str, Any] | None,
    cache_key: str | None,
    processing_store: LazyServiceWrapper[EventProcessingStore],
) -> MutableMapping[str, Any] | None:
    if data is not None:
        # An invalid inline payload must never fall back to a stale Redis copy.
        if not isinstance(data, MutableMapping) or not isinstance(data.get("event_id"), str):
            raise ValueError("Invalid inline event payload")
        if not data["event_id"]:
            raise ValueError("Missing inline event ID")
        return data
    if not cache_key:
        raise ValueError("An event payload or cache key is required")
    return processing_store.get(cache_key)


def prepare_event_payload(
    data: MutableMapping[str, Any],
    cache_key: str | None,
    *,
    event_id: str,
    processing_store: LazyServiceWrapper[EventProcessingStore] | None = None,
) -> tuple[MutableMapping[str, Any] | None, str | None]:
    # Cache-key presence fixes the write policy for the event's entire pipeline.
    if cache_key:
        if processing_store is None:
            processing_store = processing.event_processing_store
        cache_key = processing_store.store(data)
    send_inline = not cache_key or in_rollout_group("store.enable-inline-payloads", event_id)
    return (data if send_inline else None), cache_key
