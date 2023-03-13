import time
import uuid
import zlib
from typing import Iterator, List, Literal, Optional, TypedDict

from django.conf import settings

from sentry.utils import json, kafka_config
from sentry.utils.pubsub import KafkaPublisher


class ReplayActionsPayloadAction(TypedDict):
    dom_action: str
    dom_element: str
    dom_id: str
    dom_classes: List[str]
    dom_aria_label: str
    dom_aria_role: str
    dom_role: str
    dom_text_content: str
    dom_node_id: int
    timestamp: int
    event_hash: str


class ReplayActionsPayload(TypedDict):
    type: Literal["replay_actions"]
    replay_id: str
    segment_id: int
    actions: Iterator[ReplayActionsPayloadAction]


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
    segment_id: int,
    retention_days: int,
    segment_bytes: bytes,
) -> None:
    message = parse_replay_actions(project_id, replay_id, segment_id, retention_days, segment_bytes)
    if message is not None:
        publisher = _initialize_publisher()
        publisher.publish("ingest-replay-events", json.dumps(message))


def parse_replay_actions(
    project_id: int,
    replay_id: str,
    segment_id: int,
    retention_days: int,
    segment_bytes: bytes,
) -> Optional[ReplayActionsEvent]:
    """Parse RRWeb payload to ReplayActionsEvent."""
    actions = list(iter_user_actions(segment_bytes))
    if len(actions) == 0:
        return None

    payload = create_replay_actions_payload(replay_id, segment_id, actions)
    return create_replay_actions_event(replay_id, project_id, retention_days, payload)


def create_replay_actions_event(
    replay_id: str,
    project_id: int,
    retention_days: int,
    payload: ReplayActionsPayload,
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
    segment_id: int,
    actions: Iterator[ReplayActionsPayloadAction],
) -> ReplayActionsPayload:
    return {
        "type": "replay_actions",
        "replay_id": replay_id,
        "segment_id": segment_id,
        "actions": actions,
    }


def iter_user_actions(segment_data: bytes) -> Iterator[ReplayActionsPayloadAction]:
    """Return a list of ReplayActionsPayloadAction types."""
    events = json.loads(decompress(segment_data))

    for event in events:
        if event.get("type") == 5 and event.get("data", {}).get("tag") == "breadcrumb":
            payload = event["data"].get("payload", {})
            if payload.get("category") == "ui.click":
                node = payload.get("data", {}).get("node", {})
                attributes = node.get("attributes", {})
                yield {
                    "dom_action": "click",
                    "dom_element": node["tagName"],
                    "dom_id": attributes.get("id", ""),
                    "dom_classes": attributes.get("class", "").split(" "),
                    "dom_aria_label": attributes.get("aria-label", ""),
                    "dom_aria_role": attributes.get("aria-role", ""),
                    "dom_role": attributes.get("role", ""),
                    "dom_text_content": node["textContent"],
                    "dom_node_id": node["id"],
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
