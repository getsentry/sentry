from __future__ import annotations

import time
import uuid
from hashlib import md5
from typing import TYPE_CHECKING, TypedDict, Union

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


class EventLinkPayload(TypedDict):
    type: str
    replay_id: str
    timestamp: int
    event_hash: str


class EventLinkPayloadDebugId(EventLinkPayload):
    debug_id: str


class EventLinkPayloadInfoId(EventLinkPayload):
    info_id: str


class EventLinkPayloadWarningId(EventLinkPayload):
    warning_id: str


class EventLinkPayloadErrorId(EventLinkPayload):
    error_id: str


class EventLinkPayloadFatalId(EventLinkPayload):
    fatal_id: str


PayloadUnionType = Union[
    EventLinkPayloadDebugId,
    EventLinkPayloadInfoId,
    EventLinkPayloadWarningId,
    EventLinkPayloadErrorId,
    EventLinkPayloadFatalId,
]


def get_level_key(
    type: str,
    replay_id: str,
    event_hash: str,
    timestamp: int,
    level: str | None,
    event_id: str,
) -> PayloadUnionType:

    if level == "debug":
        return EventLinkPayloadDebugId(
            type=type,
            replay_id=replay_id,
            event_hash=event_hash,
            timestamp=timestamp,
            debug_id=event_id,
        )
    elif level == "info":
        return EventLinkPayloadInfoId(
            type=type,
            replay_id=replay_id,
            event_hash=event_hash,
            timestamp=timestamp,
            info_id=event_id,
        )
    elif level == "warning":
        return EventLinkPayloadWarningId(
            type=type,
            replay_id=replay_id,
            event_hash=event_hash,
            timestamp=timestamp,
            warning_id=event_id,
        )
    elif level == "error":
        return EventLinkPayloadErrorId(
            type=type,
            replay_id=replay_id,
            event_hash=event_hash,
            timestamp=timestamp,
            error_id=event_id,
        )
    elif level == "fatal":
        return EventLinkPayloadFatalId(
            type=type,
            replay_id=replay_id,
            event_hash=event_hash,
            timestamp=timestamp,
            fatal_id=event_id,
        )
    else:
        # note that this in theory should never happen, but we want to be careful
        raise ValueError(f"Invalid level {level}")


def transform_event_for_linking_payload(replay_id: str, event: BaseEvent) -> EventLinkKafkaMessage:
    def _make_json_binary_payload() -> PayloadUnionType:
        level: str | None = event.data.get("level")

        payload_with_level = get_level_key(
            type="event_link",
            replay_id=replay_id,
            event_hash=_make_event_hash(event.event_id),
            timestamp=int(event.datetime.timestamp()),
            level=level,
            event_id=event.event_id,
        )

        return payload_with_level

    return {
        "type": "replay_event",
        "start_time": int(time.time()),
        "replay_id": replay_id,
        "project_id": event.project.id,
        "segment_id": None,
        "retention_days": 90,
        "payload": list(bytes(json.dumps(_make_json_binary_payload()).encode())),
    }


def _make_event_hash(event_id: str) -> str:
    md5_hash = md5(event_id.encode("utf-8")).hexdigest()
    return str(uuid.UUID(md5_hash))
