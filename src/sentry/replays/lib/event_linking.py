from __future__ import annotations

import uuid
from hashlib import md5
from typing import TYPE_CHECKING, Literal, TypedDict

from sentry.utils import json

if TYPE_CHECKING:
    from sentry.eventstore.models import BaseEvent


class EventLinkKafkaMessage(TypedDict):
    type: str
    start_time: int
    replay_id: str
    project_id: int
    segment_id: None
    payload: list[int]
    retention_days: int


class EventLinkPayloadIds(TypedDict, total=False):
    debug_id: str
    info_id: str
    warning_id: str
    error_id: str
    fatal_id: str


class EventLinkPayload(EventLinkPayloadIds):
    type: str
    replay_id: str
    timestamp: int
    event_hash: str


def get_level_key(
    level: str | None,
) -> Literal["debug_id", "info_id", "warning_id", "error_id", "fatal_id"]:

    if level == "debug":
        return "debug_id"
    elif level == "info":
        return "info_id"
    elif level == "warning":
        return "warning_id"
    elif level == "error":
        return "error_id"
    elif level == "fatal":
        return "fatal_id"
    else:
        # note that this in theory should never happen, but we want to be careful
        raise ValueError(f"Invalid level {level}")


def transform_event_for_linking_payload(replay_id: str, event: BaseEvent) -> EventLinkKafkaMessage:
    def _make_json_binary_payload() -> EventLinkPayload:
        level: str | None = event.data.get("level")
        level_key = get_level_key(level)

        base_payload: EventLinkPayload = {
            "type": "event_link",
            "replay_id": replay_id,
            "timestamp": int(event.datetime.timestamp()),
            "event_hash": _make_event_hash(event.event_id),
        }

        base_payload[level_key] = event.event_id

        return base_payload

    return {
        "type": "replay_event",
        "start_time": int(event.datetime.timestamp()),
        "replay_id": replay_id,
        "project_id": event.project.id,
        "segment_id": None,
        "retention_days": 90,
        "payload": list(bytes(json.dumps(_make_json_binary_payload()).encode())),
    }


def _make_event_hash(event_id: str) -> str:
    md5_hash = md5(event_id.encode("utf-8")).hexdigest()
    return str(uuid.UUID(md5_hash))
