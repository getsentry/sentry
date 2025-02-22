from __future__ import annotations

import logging
import random
import time
import uuid
from collections.abc import Generator
from hashlib import md5
from typing import Any, Literal, TypedDict

import sentry_sdk

from sentry import options
from sentry.conf.types.kafka_definition import Topic
from sentry.models.project import Project
from sentry.replays.usecases.ingest.issue_creation import (
    report_hydration_error_issue_with_replay_event,
    report_rage_click_issue_with_replay_event,
)
from sentry.utils import json, kafka_config, metrics
from sentry.utils.pubsub import KafkaPublisher

logger = logging.getLogger("sentry.replays")

EVENT_LIMIT = 20

replay_publisher: KafkaPublisher | None = None

ReplayActionsEventPayloadClick = TypedDict(
    "ReplayActionsEventPayloadClick",
    {
        "alt": str,
        "aria_label": str,
        "class": list[str],
        "event_hash": str,
        "id": str,
        "node_id": int,
        "component_name": str,
        "role": str,
        "tag": str,
        "testid": str,
        "text": str,
        "timestamp": int,
        "title": str,
        "is_dead": int,
        "is_rage": int,
    },
)


class ReplayActionsEventPayload(TypedDict):
    clicks: list[ReplayActionsEventPayloadClick]
    replay_id: str
    type: Literal["replay_actions"]


class ReplayActionsEvent(TypedDict):
    payload: list[int]
    project_id: int
    replay_id: str
    retention_days: int
    start_time: float
    type: Literal["replay_event"]


def parse_and_emit_replay_actions(
    project: Project,
    replay_id: str,
    retention_days: int,
    segment_data: list[dict[str, Any]],
    replay_event: dict[str, Any] | None,
    org_id: int | None = None,
) -> None:
    with metrics.timer("replays.usecases.ingest.dom_index.parse_and_emit_replay_actions"):
        message = parse_replay_actions(
            project, replay_id, retention_days, segment_data, replay_event, org_id=org_id
        )
        if message is not None:
            emit_replay_actions(message)


@sentry_sdk.trace
def emit_replay_actions(action: ReplayActionsEvent) -> None:
    publisher = _initialize_publisher()
    publisher.publish("ingest-replay-events", json.dumps(action))


@sentry_sdk.trace
def parse_replay_actions(
    project: Project,
    replay_id: str,
    retention_days: int,
    segment_data: list[dict[str, Any]],
    replay_event: dict[str, Any] | None,
    org_id: int | None = None,
) -> ReplayActionsEvent | None:
    """Parse RRWeb payload to ReplayActionsEvent."""
    actions = get_user_actions(project, replay_id, segment_data, replay_event, org_id=org_id)
    if len(actions) == 0:
        return None

    payload = create_replay_actions_payload(replay_id, actions)
    return create_replay_actions_event(replay_id, project.id, retention_days, payload)


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
        "payload": list(json.dumps(payload).encode()),
    }


def create_replay_actions_payload(
    replay_id: str,
    clicks: list[ReplayActionsEventPayloadClick],
) -> ReplayActionsEventPayload:
    return {
        "type": "replay_actions",
        "replay_id": replay_id,
        "clicks": clicks,
    }


def log_canvas_size(
    org_id: int,
    project_id: int,
    replay_id: str,
    events: list[dict[str, Any]],
) -> None:
    for event in events:
        if (
            event.get("type") == 3
            and event.get("data", {}).get("source") == 9
            and random.randint(0, 499) < 1
        ):
            logger.info(
                # Logging to the sentry.replays.slow_click namespace because
                # its the only one configured to use BigQuery at the moment.
                #
                # NOTE: Needs an ops request to create a new dataset.
                "sentry.replays.slow_click",
                extra={
                    "event_type": "canvas_size",
                    "org_id": org_id,
                    "project_id": project_id,
                    "replay_id": replay_id,
                    "size": len(json.dumps(event)),
                },
            )


def get_user_actions(
    project: Project,
    replay_id: str,
    events: list[dict[str, Any]],
    replay_event: dict[str, Any] | None,
    org_id: int | None = None,
) -> list[ReplayActionsEventPayloadClick]:
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
    # Project option and Sentry option queries
    should_report_rage = _should_report_rage_click_issue(project)
    should_report_hydration = _should_report_hydration_error_issue(project)
    rage_click_timeout_ms = _get_rage_click_timeout(org_id)

    result: list[ReplayActionsEventPayloadClick] = []
    for event in _iter_custom_events(events):
        if len(result) == 20:
            break

        tag = event.get("data", {}).get("tag")

        if tag == "breadcrumb":
            click = _handle_breadcrumb(
                event,
                project.id,
                replay_id,
                replay_event,
                rage_click_timeout_ms,
                should_report_rage_click_issue=should_report_rage,
                should_report_hydration_error_issue=should_report_hydration,
            )
            if click is not None:
                result.append(click)
        # look for request / response breadcrumbs and report metrics on them
        if tag == "performanceSpan":
            _handle_resource_metric_event(event)
        # log the SDK options sent from the SDK 1/500 times
        if tag == "options" and random.randint(0, 499) < 1:
            _handle_options_logging_event(project.id, replay_id, event)
        # log large dom mutation breadcrumb events 1/100 times

        payload = event.get("data", {}).get("payload", {})
        if (
            isinstance(payload, dict)
            and tag == "breadcrumb"
            and payload.get("category") == "replay.mutations"
            and random.randint(0, 500) < 1
        ):
            _handle_mutations_event(project.id, replay_id, event)

    return result


def _get_testid(container: dict[str, str]) -> str:
    return (
        container.get("testId")
        or container.get("data-testid")
        or container.get("data-test-id")
        or ""
    )


def _initialize_publisher() -> KafkaPublisher:
    global replay_publisher

    if replay_publisher is None:
        config = kafka_config.get_topic_definition(Topic.INGEST_REPLAY_EVENTS)
        replay_publisher = KafkaPublisher(
            kafka_config.get_kafka_producer_cluster_options(config["cluster"])
        )

    return replay_publisher


def encode_as_uuid(message: str) -> str:
    return str(uuid.UUID(md5(message.encode()).hexdigest()))


def create_click_event(
    payload: dict[str, Any],
    replay_id: str,
    is_dead: bool,
    is_rage: bool,
    project_id: int,
) -> ReplayActionsEventPayloadClick | None:
    node = payload.get("data", {}).get("node")
    if node is None:
        return None

    attributes = node.get("attributes", {})

    # The class attribute can have extra white-space contained within. We need to filter them out
    # before truncating the list.
    classes = _parse_classes(attributes.get("class", ""))

    event: ReplayActionsEventPayloadClick = {
        "node_id": node["id"],
        "tag": node["tagName"][:32],
        "id": attributes.get("id", "")[:64],
        "class": classes,
        "text": node["textContent"][:1024],
        "role": attributes.get("role", "")[:32],
        "alt": attributes.get("alt", "")[:64],
        "testid": _get_testid(attributes)[:64],
        "aria_label": attributes.get("aria-label", "")[:64],
        "title": attributes.get("title", "")[:64],
        "component_name": attributes.get("data-sentry-component", "")[:64],
        "is_dead": int(is_dead),
        "is_rage": int(is_rage),
        "timestamp": int(payload["timestamp"]),
        "event_hash": encode_as_uuid(
            "{}{}{}".format(replay_id, str(payload["timestamp"]), str(node["id"]))
        ),
    }

    # This is unsupported and will cause errors on insert! Let's drop these bad clicks
    # and logs them to bigquery to see if we can figure out where they're coming from.
    if event["node_id"] < 0:
        # Log to "slow_click" because its the only bigquery sink
        logger.info(
            "sentry.replays.slow_click",
            extra={"event_type": "negative-click-node-id", "project_id": project_id, "data": event},
        )
        return None

    return event


def _parse_classes(classes: str) -> list[str]:
    return list(filter(lambda n: n != "", classes.split(" ")))[:10]


def _should_report_hydration_error_issue(project: Project) -> bool:
    """
    Checks the project option, controlled by a project owner.
    """
    return project.get_option("sentry:replay_hydration_error_issues")


def _should_report_rage_click_issue(project: Project) -> bool:
    """
    Checks the project option, controlled by a project owner.
    """
    return project.get_option("sentry:replay_rage_click_issues")


def _get_rage_click_timeout(org_id: int | None) -> int | float:
    """Returns the rage click timeout in milliseconds. Queries Sentry options if org_id is not None."""
    default_timeout = 7000
    if org_id and org_id in options.get("replay.rage-click.experimental-timeout.org-id-list"):
        return options.get("replay.rage-click.experimental-timeout.milliseconds")
    return default_timeout


def _iter_custom_events(events: list[dict[str, Any]]) -> Generator[dict[str, Any]]:
    for event in events:
        if event.get("type") == 5:
            yield event


def _handle_resource_metric_event(event: dict[str, Any]) -> None:
    if event["data"].get("payload", {}).get("op") not in ("resource.fetch", "resource.xhr"):
        return None

    event_payload_data = event["data"]["payload"]["data"]

    # The data key is sometimes submitted as an string. If any type other than a
    # dictionary is provided default the value to an empty dict.
    #
    # TODO: Refactor this area in a later release.
    if not isinstance(event_payload_data, dict):
        event_payload_data = {}

    if "requestBodySize" in event_payload_data:  # 7.44 and 7.45
        metrics.distribution(
            "replays.usecases.ingest.request_body_size",
            event_payload_data["requestBodySize"],
            unit="byte",
        )
    elif request := event_payload_data.get("request"):
        if isinstance(request, dict) and "size" in request:
            metrics.distribution(
                "replays.usecases.ingest.request_body_size",
                request["size"],
                unit="byte",
            )

    if "responseBodySize" in event_payload_data:  # 7.44 and 7.45
        metrics.distribution(
            "replays.usecases.ingest.response_body_size",
            event_payload_data["responseBodySize"],
            unit="byte",
        )
    elif response := event_payload_data.get("response"):
        if isinstance(response, dict) and "size" in response:
            metrics.distribution(
                "replays.usecases.ingest.response_body_size",
                response["size"],
                unit="byte",
            )


def _handle_options_logging_event(project_id: int, replay_id: str, event: dict[str, Any]) -> None:
    # log the SDK options sent from the SDK 1/500 times
    log = event["data"].get("payload", {}).copy()
    log["project_id"] = project_id
    log["replay_id"] = replay_id
    # Log to "slow_click" because its the only bigtable sink
    logger.info("sentry.replays.slow_click", extra=log)


def _handle_mutations_event(project_id: int, replay_id: str, event: dict[str, Any]) -> None:
    if (
        event.get("data", {}).get("payload", {}).get("category") == "replay.mutations"
        and random.randint(0, 99) < 1
    ):
        log = event["data"].get("payload", {}).copy()
        log["project_id"] = project_id
        log["replay_id"] = replay_id
        logger.info("Large DOM Mutations List:", extra=log)


def _handle_breadcrumb(
    event: dict[str, Any],
    project_id: int,
    replay_id: str,
    replay_event: dict[str, Any] | None,
    rage_click_timeout_ms: int | float,
    should_report_rage_click_issue=False,
    should_report_hydration_error_issue=False,
) -> ReplayActionsEventPayloadClick | None:

    click = None

    payload = event["data"].get("payload", {})
    if not isinstance(payload, dict):
        return None

    category = payload.get("category")
    if category == "ui.slowClickDetected":
        is_timeout_reason = payload["data"].get("endReason") == "timeout"
        is_target_tagname = payload["data"].get("node", {}).get("tagName") in (
            "a",
            "button",
            "input",
        )
        timeout = payload["data"].get("timeAfterClickMs", 0) or payload["data"].get(
            "timeafterclickms", 0
        )
        if is_timeout_reason and is_target_tagname and timeout >= rage_click_timeout_ms:
            is_rage = (
                payload["data"].get("clickCount", 0) or payload["data"].get("clickcount", 0)
            ) >= 5
            click = create_click_event(
                payload, replay_id, is_dead=True, is_rage=is_rage, project_id=project_id
            )
            if click is not None:
                if is_rage:
                    metrics.incr("replay.rage_click_detected")
                    if should_report_rage_click_issue:
                        if replay_event is not None:
                            report_rage_click_issue_with_replay_event(
                                project_id,
                                replay_id,
                                payload["timestamp"],
                                payload["message"],
                                payload["data"]["url"],
                                payload["data"]["node"],
                                payload["data"]["node"]["attributes"].get("data-sentry-component"),
                                replay_event,
                            )
        # Log the event for tracking.
        log = event["data"].get("payload", {}).copy()
        log["project_id"] = project_id
        log["replay_id"] = replay_id
        log["dom_tree"] = log.pop("message")

        return click

    elif category == "ui.click":
        click = create_click_event(
            payload, replay_id, is_dead=False, is_rage=False, project_id=project_id
        )
        if click is not None:
            return click

    elif category == "replay.hydrate-error":
        metrics.incr("replay.hydration_error_breadcrumb")
        if replay_event is not None and should_report_hydration_error_issue:
            report_hydration_error_issue_with_replay_event(
                project_id,
                replay_id,
                payload["timestamp"],
                payload.get("data", {}).get("url"),
                replay_event,
            )

    return None
