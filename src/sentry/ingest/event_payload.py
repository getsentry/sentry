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


def get_event_payload_transport(
    event_id: str, *, input_was_inline: bool = False
) -> EventPayloadTransport:
    send_inline = input_was_inline or in_rollout_group("store.enable-inline-payloads", event_id)
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
    input_was_inline: bool,
    data_has_changed: bool = False,
    processing_store: LazyServiceWrapper[EventProcessingStore] | None = None,
) -> tuple[MutableMapping[str, Any] | None, str | None]:
    transport = get_event_payload_transport(event_id, input_was_inline=input_was_inline)
    if transport.write_processing_store and (
        transport.send_inline or data_has_changed or not cache_key
    ):
        # Inline handoffs always refresh Redis, even if the payload is unchanged:
        # working-payload writes may have been re-enabled since the previous task.
        if processing_store is None:
            processing_store = processing.event_processing_store
        cache_key = processing_store.store(data)
    # An incoming key still represents cleanup owed when writes are disabled.
    return (data if transport.send_inline else None), cache_key
