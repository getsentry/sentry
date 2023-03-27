import time
import uuid
from hashlib import md5
from typing import Any, Dict, List, Literal, Optional, TypedDict

from django.conf import settings

from sentry.utils import json, kafka_config, metrics
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
    segment_data: List[Dict[str, Any]],
) -> None:
    with metrics.timer("replays.usecases.ingest.dom_index.parse_and_emit_replay_actions"):
        message = parse_replay_actions(project_id, replay_id, retention_days, segment_data)
        if message is not None:
            publisher = _initialize_publisher()
            publisher.publish("ingest-replay-events", json.dumps(message))


def parse_replay_actions(
    project_id: int,
    replay_id: str,
    retention_days: int,
    segment_data: List[Dict[str, Any]],
) -> Optional[ReplayActionsEvent]:
    """Parse RRWeb payload to ReplayActionsEvent."""
    actions = get_user_actions(replay_id, segment_data)
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
        "payload": list(json.dumps(payload).encode()),  # type: ignore
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


def get_user_actions(
    replay_id: str,
    events: List[Dict[str, Any]],
) -> List[ReplayActionsEventPayloadClick]:
    """Return a list of ReplayActionsEventPayloadClick types."""
    result = []
    for event in events:
        if event.get("type") == 5 and event.get("data", {}).get("tag") == "breadcrumb":
            payload = event["data"].get("payload", {})
            if payload.get("category") == "ui.click":
                node = payload.get("data", {}).get("node", {})
                attributes = node.get("attributes", {})

                result.append(
                    {
                        "node_id": node["id"],
                        "tag": node["tagName"][:32],
                        "id": attributes.get("id", "")[:64],
                        "class": attributes.get("class", "").split(" ")[:10],
                        "text": node["textContent"][:1024],
                        "role": attributes.get("role", "")[:32],
                        "alt": attributes.get("alt", "")[:64],
                        "testid": attributes.get("testid", "")[:64],
                        "aria_label": attributes.get("aria-label", "")[:64],
                        "title": attributes.get("title", "")[:64],
                        "timestamp": int(payload["timestamp"]),
                        "event_hash": encode_as_uuid(
                            "{}{}{}".format(replay_id, str(payload["timestamp"]), str(node["id"]))
                        ),
                    }
                )

    return result


def _initialize_publisher() -> KafkaPublisher:
    global replay_publisher

    if replay_publisher is None:
        config = settings.KAFKA_TOPICS[settings.KAFKA_INGEST_REPLAY_EVENTS]
        replay_publisher = KafkaPublisher(
            kafka_config.get_kafka_producer_cluster_options(config["cluster"])
        )

    return replay_publisher


def encode_as_uuid(message: str) -> str:
    return uuid.UUID(md5(message.encode()).hexdigest()).hex
