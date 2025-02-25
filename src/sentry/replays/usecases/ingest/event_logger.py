import logging
from typing import Any

import sentry_sdk

from sentry.models.project import Project
from sentry.replays.usecases.ingest.dom_index import (
    ReplayActionsEvent,
    ReplayActionsEventPayload,
    _initialize_publisher,
)
from sentry.replays.usecases.ingest.event_parser import ClickEvent, ParsedEventMeta
from sentry.replays.usecases.ingest.issue_creation import (
    report_hydration_error_issue_with_replay_event,
    report_rage_click_issue_with_replay_event,
)
from sentry.utils import json, metrics

logger = logging.getLogger()


def emit_click_events(
    click_events: list[ClickEvent],
    project_id: int,
    replay_id: str,
    retention_days: int,
    start_time: float,
) -> None:
    clicks = [
        {
            "alt": click.alt,
            "aria_label": click.aria_label,
            "class": click.classes,
            "component_name": click.component_name,
            "id": click.id,
            "is_dead": click.is_dead,
            "is_rage": click.is_rage,
            "node_id": click.node_id,
            "role": click.role,
            "selector": click.selector,
            "tag": click.tag,
            "testid": click.testid,
            "text": click.text,
            "timestamp": click.timestamp,
            "title": click.title,
        }
        for click in click_events
    ]

    payload: ReplayActionsEventPayload = {
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

    publisher = _initialize_publisher()
    publisher.publish("ingest-replay-events", json.dumps(action))
    publisher.flush()


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

    if not replay_event or not _should_report_hydration_error_issue(project):
        return None

    for error in event_meta.hydration_errors:
        report_hydration_error_issue_with_replay_event(
            project.id,
            replay_id,
            error.timestamp,
            error.url,
            replay_event,
        )


@sentry_sdk.trace
def report_rage_click(
    event_meta: ParsedEventMeta,
    project: Project,
    replay_id: str,
    replay_event: dict[str, Any] | None,
) -> None:
    for click in filter(lambda c: c.is_rage, event_meta.click_events):
        metrics.incr("replay.rage_click_detected")
        if replay_event is not None and click.url and _should_report_rage_click_issue(project):
            node = {
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
            }
            report_rage_click_issue_with_replay_event(
                project.id,
                replay_id,
                click.timestamp,
                click.selector,
                click.url,
                node,
                click.component_name,
                replay_event,
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
