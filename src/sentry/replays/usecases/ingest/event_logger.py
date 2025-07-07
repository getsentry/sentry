import logging
import uuid
from collections.abc import Generator
from hashlib import md5
from typing import Any, TypedDict

import sentry_sdk

from sentry.models.project import Project
from sentry.replays.lib.kafka import publish_replay_event
from sentry.replays.usecases.ingest.dom_index import (
    ReplayActionsEvent,
    ReplayActionsEventPayload,
    ReplayActionsEventPayloadClick,
)
from sentry.replays.usecases.ingest.event_parser import ClickEvent, ParsedEventMeta
from sentry.replays.usecases.ingest.issue_creation import (
    report_hydration_error_issue_with_replay_event,
    report_rage_click_issue_with_replay_event,
)
from sentry.utils import json, metrics

logger = logging.getLogger()


@sentry_sdk.trace
def emit_click_events(
    click_events: list[ClickEvent],
    project_id: int,
    replay_id: str,
    retention_days: int,
    start_time: float,
    event_cap: int = 20,
    environment: str | None = None,
) -> None:
    # Skip event emission if no clicks specified.
    if len(click_events) == 0:
        return None

    clicks: list[ReplayActionsEventPayloadClick] = [
        {
            "alt": click.alt,
            "aria_label": click.aria_label,
            "class": click.classes,
            "component_name": click.component_name,
            "event_hash": encode_as_uuid(f"{replay_id}{click.timestamp}{click.node_id}"),
            "id": click.id,
            "is_dead": click.is_dead,
            "is_rage": click.is_rage,
            "node_id": click.node_id,
            "role": click.role,
            "tag": click.tag,
            "testid": click.testid,
            "text": click.text,
            "timestamp": click.timestamp,
            "title": click.title,
        }
        for click in click_events[:event_cap]
    ]

    payload: ReplayActionsEventPayload = {
        "environment": environment or "",
        "replay_id": replay_id,
        "type": "replay_actions",
        "clicks": clicks,
    }

    action: ReplayActionsEvent = {
        "project_id": project_id,
        "replay_id": replay_id,
        "retention_days": retention_days,
        "start_time": start_time,
        "type": "replay_event",
        "payload": list(json.dumps(payload).encode()),
    }

    publish_replay_event(json.dumps(action))


@sentry_sdk.trace
def emit_request_response_metrics(event_meta: ParsedEventMeta) -> None:
    for sizes in event_meta.request_response_sizes:
        req_size, res_size = sizes

        if req_size:
            metrics.distribution("replays.usecases.ingest.request_body_size", req_size, unit="byte")

        if res_size:
            metrics.distribution(
                "replays.usecases.ingest.response_body_size", res_size, unit="byte"
            )


@sentry_sdk.trace
def log_canvas_size(
    event_meta: ParsedEventMeta, org_id: int, project_id: int, replay_id: str
) -> None:
    for canvas_size in event_meta.canvas_sizes:
        logger.info(
            "sentry.replays.slow_click",
            extra={
                "event_type": "canvas_size",
                "org_id": org_id,
                "project_id": project_id,
                "replay_id": replay_id,
                "size": canvas_size,
            },
        )


@sentry_sdk.trace
def log_mutation_events(event_meta: ParsedEventMeta, project_id: int, replay_id: str) -> None:
    # TODO: sampled differently from the rest (0 <= i <= 99)
    # probably fine to ignore.
    for mutation in event_meta.mutation_events:
        log = mutation.payload.copy()
        log["project_id"] = project_id
        log["replay_id"] = replay_id
        logger.info("Large DOM Mutations List:", extra=log)


@sentry_sdk.trace
def log_option_events(event_meta: ParsedEventMeta, project_id: int, replay_id: str) -> None:
    for option in event_meta.options_events:
        log = option["data"].get("payload", {}).copy()
        log["project_id"] = project_id
        log["replay_id"] = replay_id
        logger.info("sentry.replays.slow_click", extra=log)


@sentry_sdk.trace
def report_hydration_error(
    event_meta: ParsedEventMeta,
    project: Project,
    replay_id: str,
    replay_event: dict[str, Any] | None,
) -> None:
    metrics.incr("replay.hydration_error_breadcrumb", amount=len(event_meta.hydration_errors))

    # Eagerly exit to prevent unnecessary I/O.
    if (
        len(event_meta.hydration_errors) == 0
        or not replay_event
        or not _should_report_hydration_error_issue(project)
    ):
        return None

    for error in event_meta.hydration_errors:
        report_hydration_error_issue_with_replay_event(
            project.id,
            replay_id,
            error.timestamp,
            error.url,
            replay_event,
        )


class RageClickIssue(TypedDict):
    component_name: str
    node: dict[str, Any]
    project_id: int
    replay_event: dict[str, Any]
    replay_id: str
    selector: str
    timestamp: int
    url: str


def gen_rage_clicks(
    event_meta: ParsedEventMeta,
    project_id: int,
    replay_id: str,
    replay_event: dict[str, Any] | None,
) -> Generator[RageClickIssue]:
    if not replay_event:
        return None

    for click in filter(lambda c: c.is_rage and c.url, event_meta.click_events):
        yield {
            "component_name": click.component_name,
            "node": {
                "id": click.node_id,
                "tagName": click.tag,
                "attributes": {
                    "id": click.id,
                    "class": " ".join(click.classes),
                    "aria-label": click.aria_label,
                    "role": click.role,
                    "alt": click.alt,
                    "data-testid": click.testid,
                    "title": click.title,
                    "data-sentry-component": click.component_name,
                },
                "textContent": click.text,
            },
            "project_id": project_id,
            "replay_event": replay_event,
            "replay_id": replay_id,
            "selector": click.selector,
            "timestamp": click.timestamp,
            "url": str(click.url),
        }


@sentry_sdk.trace
def report_rage_click(
    event_meta: ParsedEventMeta,
    project: Project,
    replay_id: str,
    replay_event: dict[str, Any] | None,
) -> None:
    clicks = list(gen_rage_clicks(event_meta, project.id, replay_id, replay_event))
    if len(clicks) == 0 or not _should_report_rage_click_issue(project):
        return None

    metrics.incr("replay.rage_click_detected", amount=len(clicks))

    for click in clicks:
        report_rage_click_issue_with_replay_event(
            click["project_id"],
            click["replay_id"],
            click["timestamp"],
            click["selector"],
            click["url"],
            click["node"],
            click["component_name"],
            click["replay_event"],
        )


@sentry_sdk.trace
def _should_report_hydration_error_issue(project: Project) -> bool:
    """
    Checks the project option, controlled by a project owner.
    """
    return project.get_option("sentry:replay_hydration_error_issues")


@sentry_sdk.trace
def _should_report_rage_click_issue(project: Project) -> bool:
    """
    Checks the project option, controlled by a project owner.
    """
    return project.get_option("sentry:replay_rage_click_issues")


def encode_as_uuid(message: str) -> str:
    return str(uuid.UUID(md5(message.encode()).hexdigest()))
