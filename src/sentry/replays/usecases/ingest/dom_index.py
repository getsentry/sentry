import time
import uuid
import zlib
from typing import Iterator, List, Literal, Optional, TypedDict

from django.conf import settings

from sentry.utils import json, kafka_config
from sentry.utils.pubsub import KafkaPublisher

replay_publisher: Optional[KafkaPublisher] = None

ReplayActionsEventPayloadClick = TypedDict(
    "ReplayActionsEventPayloadClick",
    {
        "node_id": int,
        "tag": str,
        "id": str,
        "class": List[str],
        "role": str,
        "aria_label": str,
        "alt": str,
        "testid": str,
        "title": str,
        "text": str,
        "timestamp": int,
        "event_hash": str,
    },
)


class ReplayActionsEventPayload(TypedDict):
    type: Literal["replay_actions"]
    replay_id: str
    clicks: List[ReplayActionsEventPayloadClick]


class ReplayActionsEvent(TypedDict):
    type: Literal["replay_event"]
    start_time: float
    replay_id: str
    project_id: int
    retention_days: int
    payload: List[bytes]


def parse_and_emit_replay_actions(
    project_id: int,
    replay_id: str,
    retention_days: int,
    segment_bytes: bytes,
) -> None:
    message = parse_replay_actions(project_id, replay_id, retention_days, segment_bytes)
    if message is not None:
        publisher = _initialize_publisher()
        publisher.publish("ingest-replay-events", json.dumps(message))


def parse_replay_actions(
    project_id: int,
    replay_id: str,
    retention_days: int,
    segment_bytes: bytes,
) -> Optional[ReplayActionsEvent]:
    """Parse RRWeb payload to ReplayActionsEvent."""
    actions = list(iter_user_actions(segment_bytes))
    if len(actions) == 0:
        return None

    payload = create_replay_actions_payload(replay_id, actions)
    return create_replay_actions_event(replay_id, project_id, retention_days, payload)


def create_replay_actions_event(
    replay_id: str,
    project_id: int,
    retention_days: int,
    payload: ReplayActionsEventPayload,
) -> ReplayActionsEvent:
    return {
        "type": "replay_event",
        "start_time": time.time(),
        "replay_id": replay_id,
        "project_id": project_id,
        "retention_days": retention_days,
        "payload": list(bytes(json.dumps(payload).encode())),
    }


def create_replay_actions_payload(
    replay_id: str,
    clicks: List[ReplayActionsEventPayloadClick],
) -> ReplayActionsEventPayload:
    return {
        "type": "replay_actions",
        "replay_id": replay_id,
        "clicks": clicks,
    }


def iter_user_actions(segment_data: bytes) -> Iterator[ReplayActionsEventPayloadClick]:
    """Return a list of ReplayActionsEventPayloadClick types."""
    events = json.loads(decompress(segment_data))

    for event in events:
        if event.get("type") == 5 and event.get("data", {}).get("tag") == "breadcrumb":
            payload = event["data"].get("payload", {})
            if payload.get("category") == "ui.click":
                node = payload.get("data", {}).get("node", {})
                attributes = node.get("attributes", {})
                yield {
                    "node_id": node["id"],
                    "tag": node["tagName"],
                    "id": attributes.get("id", ""),
                    "class": attributes.get("class", "").split(" "),
                    "text": node["textContent"],
                    "role": attributes.get("role", ""),
                    "alt": attributes.get("alt", ""),
                    "testid": attributes.get("testid", ""),
                    "aria_label": attributes.get("aria-label", ""),
                    "title": attributes.get("title", ""),
                    "timestamp": int(payload["timestamp"]),
                    "event_hash": uuid.uuid4().hex,
                }


def decompress(data: bytes) -> bytes:
    """Return decompressed bytes."""
    if data.startswith(b"["):
        return data
    else:
        return zlib.decompress(data, zlib.MAX_WBITS | 32)


def _initialize_publisher() -> KafkaPublisher:
    global replay_publisher

    if replay_publisher is None:
        config = settings.KAFKA_TOPICS[settings.KAFKA_INGEST_REPLAY_EVENTS]
        replay_publisher = KafkaPublisher(
            kafka_config.get_kafka_producer_cluster_options(config["cluster"]),
            asynchronous=False,
        )

    return replay_publisher
