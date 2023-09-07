from __future__ import annotations

from hashlib import md5
from typing import TYPE_CHECKING, TypedDict

from sentry.utils.json import json

if TYPE_CHECKING:
    from sentry.eventstore.models import BaseEvent


class EventLinkKafkaMessage(TypedDict):
    type: str
    start_time: str
    replay_id: str
    project_id: int
    segment_id: None
    payload: list[int]
    retention_days: int


class EventLinkPayload(TypedDict):
    type: str
    replay_id: str
    error_id: str
    timestamp: int
    event_hash: str


def transform_event_for_linking_payload(replay_id: str, event: BaseEvent) -> EventLinkKafkaMessage:
    def _make_json_binary_payload() -> EventLinkPayload:
        return {
            "type": "event_link",
            "replay_id": replay_id,
            "error_id": event.event_id,
            "timestamp": int(event.datetime.timestamp()),
            "event_hash": md5((replay_id + event.event_id).encode("utf-8")).hexdigest(),
        }

    return {
        "type": "replay_event",
        "start_time": int(event.datetime.timestamp()),
        "replay_id": replay_id,
        "project_id": event.project.id,
        "segment_id": None,
        "retention_days": 90,
        "payload": list(bytes(json.dumps(_make_json_binary_payload()).encode())),
    }
