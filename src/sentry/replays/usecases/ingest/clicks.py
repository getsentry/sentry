import logging
import time
import uuid
from hashlib import md5
from typing import Dict, List, Literal, Optional, TypedDict

from django.conf import settings

from sentry.replays.usecases.ingest.events import SentryEvent
from sentry.utils import json, kafka_config
from sentry.utils.pubsub import KafkaPublisher

logger = logging.getLogger("sentry.replays")

EVENT_LIMIT = 20

replay_publisher: Optional[KafkaPublisher] = None

ReplayActionsEventPayloadClick = TypedDict(
    "ReplayActionsEventPayloadClick",
    {
        "alt": str,
        "aria_label": str,
        "class": List[str],
        "event_hash": str,
        "id": str,
        "node_id": int,
        "role": str,
        "tag": str,
        "testid": str,
        "text": str,
        "timestamp": int,
        "title": str,
    },
)


class ReplayActionsEventPayload(TypedDict):
    clicks: List[ReplayActionsEventPayloadClick]
    replay_id: str
    type: Literal["replay_actions"]


class ReplayActionsEvent(TypedDict):
    payload: List[bytes]
    project_id: int
    replay_id: str
    retention_days: int
    start_time: float
    type: Literal["replay_event"]


def process_click_event(
    replay_id: str,
    event: SentryEvent,
) -> Optional[ReplayActionsEventPayloadClick]:
    """Optionally return a ReplayActionsEventPayloadClick type.

    The node object is a partially destructured HTML element with an additional RRWeb
    identifier included. Node objects are not recursive and truncate their children. Text is
    extracted and stored on the textContent key.

    For example, the follow DOM element:

        <div id="a" class="b c">Hello<span>, </span>world!</div>

    Would be destructured as:

        {
            "id": 217,
            "tagName": "div",
            "attributes": {"id": "a", "class": "b c"},
            "textContent": "Helloworld!"
        }
    """
    node = event["data"]["payload"].get("data", {}).get("node")
    if node is None:
        return None

    attributes = node.get("attributes", {})

    return {
        "node_id": node["id"],
        "tag": node["tagName"][:32],
        "id": attributes.get("id", "")[:64],
        "class": attributes.get("class", "").split(" ")[:10],
        "text": node["textContent"][:1024],
        "role": attributes.get("role", "")[:32],
        "alt": attributes.get("alt", "")[:64],
        "testid": _get_testid(attributes)[:64],
        "aria_label": attributes.get("aria-label", "")[:64],
        "title": attributes.get("title", "")[:64],
        "timestamp": int(event["data"]["payload"]["timestamp"]),
        "event_hash": _encode_as_uuid(
            "{}{}{}".format(replay_id, str(event["data"]["payload"]["timestamp"]), str(node["id"]))
        ),
    }


def commit_click_events(
    retention_days: int,
    project_id: int,
    replay_id: str,
    clicks: List[ReplayActionsEventPayloadClick],
) -> None:
    # Exit early. No click events means nothing to commit.
    if len(clicks) == 0:
        return None

    # We only index the first {EVENT_LIMIT} clicks encountered. Everything else is dropped.
    clicks = clicks[:EVENT_LIMIT]

    # Create and publish the payload to Kafka.
    payload = _create_replay_actions_payload(replay_id, clicks)
    message = _create_replay_actions_event(replay_id, project_id, retention_days, payload)

    publisher = _initialize_publisher()
    publisher.publish("ingest-replay-events", json.dumps(message))


def _create_replay_actions_event(
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


def _create_replay_actions_payload(
    replay_id: str,
    clicks: List[ReplayActionsEventPayloadClick],
) -> ReplayActionsEventPayload:
    return {
        "type": "replay_actions",
        "replay_id": replay_id,
        "clicks": clicks,
    }


def _get_testid(container: Dict[str, str]) -> str:
    return (
        container.get("testId")
        or container.get("data-testid")
        or container.get("data-test-id")
        or ""
    )


def _initialize_publisher() -> KafkaPublisher:
    global replay_publisher

    if replay_publisher is None:
        config = settings.KAFKA_TOPICS[settings.KAFKA_INGEST_REPLAY_EVENTS]
        replay_publisher = KafkaPublisher(
            kafka_config.get_kafka_producer_cluster_options(config["cluster"])
        )

    return replay_publisher


def _encode_as_uuid(message: str) -> str:
    return str(uuid.UUID(md5(message.encode()).hexdigest()))
