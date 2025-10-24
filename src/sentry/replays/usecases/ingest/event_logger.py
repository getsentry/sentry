import logging
import random
import uuid
from collections.abc import Callable, Generator
from hashlib import md5
from typing import Any, Literal, TypedDict

import sentry_sdk
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry.models.options.project_option import ProjectOption
from sentry.replays.lib.eap.write import write_trace_items
from sentry.replays.lib.kafka import publish_replay_event
from sentry.replays.usecases.ingest.event_parser import ClickEvent, ParsedEventMeta, TapEvent
from sentry.replays.usecases.ingest.issue_creation import (
    report_hydration_error_issue_with_replay_event,
    report_rage_click_issue_with_replay_event,
)
from sentry.replays.usecases.ingest.types import ProcessorContext
from sentry.utils import json, metrics

logger = logging.getLogger()


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


class ReplayActionsEventPayloadTap(TypedDict):
    message: str
    view_id: str
    view_class: str
    timestamp: int
    event_hash: str


class ReplayActionsEventClickPayload(TypedDict):
    environment: str
    clicks: list[ReplayActionsEventPayloadClick]
    replay_id: str
    type: Literal["replay_actions"]


class ReplayActionsEventTapPayload(TypedDict):
    environment: str
    taps: list[ReplayActionsEventPayloadTap]
    replay_id: str
    type: Literal["replay_tap"]


class ReplayActionsEvent(TypedDict):
    payload: ReplayActionsEventClickPayload | ReplayActionsEventTapPayload
    project_id: int
    replay_id: str
    retention_days: int
    start_time: float
    type: Literal["replay_event"]


@sentry_sdk.trace
def emit_tap_events(
    tap_events: list[TapEvent],
    project_id: int,
    replay_id: str,
    retention_days: int,
    start_time: float,
    event_cap: int = 20,
    environment: str | None = None,
) -> None:
    # Skip event emission if no taps specified.
    if len(tap_events) == 0:
        return None

    taps: list[ReplayActionsEventPayloadTap] = [
        {
            "message": tap.message,
            "view_id": tap.view_id,
            "view_class": tap.view_class,
            "timestamp": tap.timestamp,
            "event_hash": encode_as_uuid(f"{replay_id}{tap.timestamp}{tap.view_id}"),
        }
        for tap in tap_events[:event_cap]
    ]

    payload: ReplayActionsEventTapPayload = {
        "environment": environment or "",
        "replay_id": replay_id,
        "type": "replay_tap",
        "taps": taps,
    }

    action: ReplayActionsEvent = {
        "project_id": project_id,
        "replay_id": replay_id,
        "retention_days": retention_days,
        "start_time": start_time,
        "type": "replay_event",
        "payload": payload,
    }

    publish_replay_event(json.dumps(action))


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

    payload: ReplayActionsEventClickPayload = {
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
        "payload": payload,
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
def log_multiclick_events(
    event_meta: ParsedEventMeta,
    project_id: int,
    replay_id: str,
    # Sample multiclick events at 0.2% rate
    should_sample: Callable[[], bool] = lambda: random.random() < 0.002,
) -> None:
    for multiclick in event_meta.multiclick_events:
        if not should_sample():
            continue

        log = {
            "event_type": "multi_click",
            "project_id": project_id,
            "replay_id": replay_id,
            "alt": multiclick.click_event.alt,
            "aria_label": multiclick.click_event.aria_label,
            "classes": multiclick.click_event.classes,
            "component_name": multiclick.click_event.component_name,
            "id": multiclick.click_event.id,
            "node_id": multiclick.click_event.node_id,
            "role": multiclick.click_event.role,
            "selector": multiclick.click_event.selector,
            "tag": multiclick.click_event.tag,
            "testid": multiclick.click_event.testid,
            "text": multiclick.click_event.text[:100],  # Truncate text for logging
            "timestamp": multiclick.click_event.timestamp,
            "url": multiclick.click_event.url or "",
            "title": multiclick.click_event.title,
            "click_count": multiclick.click_count,
        }
        logger.info("sentry.replays.slow_click", extra=log)


@sentry_sdk.trace
def log_rage_click_events(
    event_meta: ParsedEventMeta,
    project_id: int,
    replay_id: str,
    # Sample rage multiclick events at 0.2% rate
    should_sample: Callable[[], bool] = lambda: random.random() < 0.002,
) -> None:
    for click in event_meta.click_events:
        if click.is_rage and should_sample():
            log = {
                "event_type": "rage_click",
                "project_id": project_id,
                "replay_id": replay_id,
                "alt": click.alt,
                "aria_label": click.aria_label,
                "classes": click.classes,
                "component_name": click.component_name,
                "id": click.id,
                "is_rage_click": True,
                "is_dead_click": bool(click.is_dead),
                "node_id": click.node_id,
                "role": click.role,
                "selector": click.selector,
                "tag": click.tag,
                "testid": click.testid,
                "text": click.text[:100],  # Truncate text for logging
                "timestamp": click.timestamp,
                "url": click.url or "",
                "title": click.title,
            }
            logger.info("sentry.replays.slow_click", extra=log)


@sentry_sdk.trace
def report_hydration_error(
    event_meta: ParsedEventMeta,
    project_id: int,
    replay_id: str,
    replay_event: dict[str, Any] | None,
    context: ProcessorContext,
) -> None:
    metrics.incr("replay.hydration_error_breadcrumb", amount=len(event_meta.hydration_errors))

    # Eagerly exit to prevent unnecessary I/O.
    if (
        len(event_meta.hydration_errors) == 0
        or not replay_event
        or not _should_report_hydration_error_issue(project_id, context)
    ):
        return None

    for error in event_meta.hydration_errors:
        report_hydration_error_issue_with_replay_event(
            project_id,
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
    project_id: int,
    replay_id: str,
    replay_event: dict[str, Any] | None,
    context: ProcessorContext,
) -> None:
    clicks = list(gen_rage_clicks(event_meta, project_id, replay_id, replay_event))
    if len(clicks) == 0 or not _should_report_rage_click_issue(project_id, context):
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


def _largest_attr(ti: TraceItem) -> tuple[str, int]:
    if not ti.attributes:
        return ("", 0)
    name, anyv = max(ti.attributes.items(), key=lambda kv: kv[1].ByteSize())
    return name, anyv.ByteSize()


@sentry_sdk.trace
def emit_trace_items_to_eap(trace_items: list[TraceItem]) -> None:
    largest_attribute = max(
        ((ti, *_largest_attr(ti)) for ti in trace_items),
        key=lambda t: t[2],
        default=None,
    )

    with sentry_sdk.start_span(op="process", name="write_trace_items") as span:
        if largest_attribute:
            ti, name, size = largest_attribute
            span.set_data("largest_attr_trace_id", ti.trace_id)
            span.set_data("largest_attr_name", name)
            span.set_data("largest_attr_size_bytes", size)
        write_trace_items(trace_items)


@sentry_sdk.trace
def _should_report_hydration_error_issue(project_id: int, context: ProcessorContext) -> bool:
    """
    Checks the project option, controlled by a project owner.
    """
    if context["options_cache"]:
        return context["options_cache"][project_id][0]
    else:
        return ProjectOption.objects.get_value(
            project_id,
            "sentry:replay_hydration_error_issues",
            default=True,
        )


@sentry_sdk.trace
def _should_report_rage_click_issue(project_id: int, context: ProcessorContext) -> bool:
    """
    Checks the project option, controlled by a project owner.
    """
    if context["options_cache"]:
        return context["options_cache"][project_id][1]
    else:
        return ProjectOption.objects.get_value(
            project_id,
            "sentry:replay_rage_click_issues",
            default=True,
        )


def encode_as_uuid(message: str) -> str:
    return str(uuid.UUID(md5(message.encode()).hexdigest()))
