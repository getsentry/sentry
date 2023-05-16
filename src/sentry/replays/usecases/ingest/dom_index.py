import logging
import random
import time
import uuid
from hashlib import md5
from typing import Any, Dict, List, Literal, Optional, TypedDict

from django.conf import settings

from sentry.utils import json, kafka_config, metrics
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
    actions = get_user_actions(project_id, replay_id, segment_data)
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
    project_id: int,
    replay_id: str,
    events: List[Dict[str, Any]],
) -> List[ReplayActionsEventPayloadClick]:
    """Return a list of ReplayActionsEventPayloadClick types.

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
    result: List[ReplayActionsEventPayloadClick] = []
    for event in events:
        if len(result) == 20:
            break

        if event.get("type") == 5 and event.get("data", {}).get("tag") == "breadcrumb":
            payload = event["data"].get("payload", {})
            category = payload.get("category")
            if category == "ui.slowClickDetected":
                payload["project_id"] = project_id
                payload["replay_id"] = replay_id
                payload["dom_tree"] = payload.pop("message")
                logger.info("sentry.replays.slow_click", extra=payload)
            elif category == "ui.click":
                node = payload.get("data", {}).get("node")
                if node is None:
                    continue

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
                        "testid": _get_testid(attributes)[:64],
                        "aria_label": attributes.get("aria-label", "")[:64],
                        "title": attributes.get("title", "")[:64],
                        "timestamp": int(payload["timestamp"]),
                        "event_hash": encode_as_uuid(
                            "{}{}{}".format(replay_id, str(payload["timestamp"]), str(node["id"]))
                        ),
                    }
                )

        # look for request / response breadcrumbs and report metrics on them
        if event.get("type") == 5 and event.get("data", {}).get("tag") == "performanceSpan":
            if event["data"].get("payload", {}).get("op") in ("resource.fetch", "resource.xhr"):
                event_payload_data = event["data"]["payload"]["data"]

                # these first two cover SDKs 7.44 and 7.45
                if event_payload_data.get("requestBodySize"):
                    metrics.timing(
                        "replays.usecases.ingest.request_body_size",
                        event_payload_data["requestBodySize"],
                    )
                if event_payload_data.get("responseBodySize"):
                    metrics.timing(
                        "replays.usecases.ingest.response_body_size",
                        event_payload_data["responseBodySize"],
                    )

                # what the most recent SDKs send:
                if event_payload_data.get("request", {}).get("size"):
                    metrics.timing(
                        "replays.usecases.ingest.request_body_size",
                        event_payload_data["request"]["size"],
                    )
                if event_payload_data.get("response", {}).get("size"):
                    metrics.timing(
                        "replays.usecases.ingest.response_body_size",
                        event_payload_data["response"]["size"],
                    )
        # log the SDK options sent from the SDK 1/500 times
        if (
            event.get("type") == 5
            and event.get("data", {}).get("tag") == "options"
            and random.randint(0, 499) < 1
        ):
            log = event["data"].get("payload", {}).copy()
            log["project_id"] = project_id
            log["replay_id"] = replay_id
            logger.info("SDK Options:", extra=log)

    return result


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


def encode_as_uuid(message: str) -> str:
    return str(uuid.UUID(md5(message.encode()).hexdigest()))
