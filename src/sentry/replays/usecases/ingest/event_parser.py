from __future__ import annotations

import logging
import random
import uuid
from collections.abc import Iterator
from dataclasses import dataclass
from enum import Enum
from typing import Any, TypedDict

import sentry_sdk

from sentry.utils import json

logger = logging.getLogger()


@dataclass(frozen=True)
class ClickEvent:
    alt: str
    aria_label: str
    classes: list[str]
    component_name: str
    id: str
    is_dead: int
    is_rage: int
    node_id: int
    role: str
    selector: str
    tag: str
    testid: str
    text: str
    timestamp: int
    title: str
    url: str | None


@dataclass
class HydrationError:
    timestamp: float
    url: str | None


@dataclass
class MutationEvent:
    payload: dict[str, Any]


@dataclass(frozen=True)
class ParsedEventMeta:
    canvas_sizes: list[int]
    click_events: list[ClickEvent]
    hydration_errors: list[HydrationError]
    mutation_events: list[MutationEvent]
    options_events: list[dict[str, Any]]
    request_response_sizes: list[tuple[Any, Any]]


@sentry_sdk.trace
def parse_events(events: list[dict[str, Any]]) -> ParsedEventMeta:
    return parse_highlighted_events(events, sampled=random.randint(0, 499) < 1)


class EventType(Enum):
    CLICK = 0
    DEAD_CLICK = 1
    RAGE_CLICK = 2
    NAVIGATION = 3
    CONSOLE = 4
    UI_BLUR = 5
    UI_FOCUS = 6
    RESOURCE_FETCH = 7
    RESOURCE_XHR = 8
    LCP = 9
    FCP = 10
    HYDRATION_ERROR = 11
    MUTATIONS = 12
    UNKNOWN = 13
    CANVAS = 14
    OPTIONS = 15
    FEEDBACK = 16
    MEMORY = 17


def which(event: dict[str, Any]) -> EventType:
    """Identify the passed event.

    This function helpfully hides the dirty data munging necessary to identify an event type and
    helpfully reduces the number of operations required by reusing context from previous
    branches.

    We EXPLICITLY do not allow fall through. You must always terminate at your branch depth or
    mypy will complain. This is not a bug. You must exhaustively examine the event and if you
    can't identify it exit.
    """
    try:
        if event["type"] == 3:
            if event["data"]["source"] == 9:
                return EventType.CANVAS
            else:
                return EventType.UNKNOWN
        elif event["type"] == 5:
            if event["data"]["tag"] == "breadcrumb":
                payload = event["data"]["payload"]
                category = payload["category"]
                if category == "ui.click":
                    return EventType.CLICK
                elif category == "ui.slowClickDetected":
                    is_timeout_reason = payload["data"].get("endReason") == "timeout"
                    is_target_tagname = payload["data"].get("node", {}).get("tagName") in (
                        "a",
                        "button",
                        "input",
                    )
                    timeout = payload["data"].get("timeAfterClickMs", 0) or payload["data"].get(
                        "timeafterclickms", 0
                    )

                    if is_timeout_reason and is_target_tagname and timeout >= 7000:
                        is_rage = (
                            payload["data"].get("clickCount", 0)
                            or payload["data"].get("clickcount", 0)
                        ) >= 5
                        if is_rage:
                            return EventType.RAGE_CLICK
                        else:
                            return EventType.DEAD_CLICK
                    else:
                        return EventType.UNKNOWN
                elif category == "navigation":
                    return EventType.NAVIGATION
                elif category == "console":
                    return EventType.CONSOLE
                elif category == "ui.blur":
                    return EventType.UI_BLUR
                elif category == "ui.focus":
                    return EventType.UI_FOCUS
                elif category == "replay.hydrate-error":
                    return EventType.HYDRATION_ERROR
                elif category == "replay.mutations":
                    return EventType.MUTATIONS
                else:
                    return EventType.UNKNOWN
            elif event["data"]["tag"] == "performanceSpan":
                payload = event["data"]["payload"]
                op = payload["op"]
                if op == "resource.fetch":
                    return EventType.RESOURCE_FETCH
                elif op == "resource.xhr":
                    return EventType.RESOURCE_XHR
                elif op == "web-vital":
                    if payload["description"] == "largest-contentful-paint":
                        return EventType.LCP
                    elif payload["description"] == "first-contentful-paint":
                        return EventType.FCP
                    else:
                        return EventType.UNKNOWN
                elif op == "memory":
                    return EventType.MEMORY
                else:
                    return EventType.UNKNOWN
            elif event["data"]["tag"] == "options":
                return EventType.OPTIONS
            else:
                return EventType.UNKNOWN
        else:
            return EventType.UNKNOWN
    except (AttributeError, KeyError, TypeError):
        return EventType.UNKNOWN
    except Exception:
        logger.exception("Event type could not be determined.")
        return EventType.UNKNOWN


def which_iter(events: list[dict[str, Any]]) -> Iterator[tuple[EventType, dict[str, Any]]]:
    for event in events:
        yield (which(event), event)


class MessageContext(TypedDict):
    organization_id: int
    project_id: int
    received: float
    retention_days: int
    trace_id: str | None
    replay_id: str
    segment_id: int


class TraceItemContext(TypedDict):
    attributes: dict[str, str | int | bool | float]
    event_hash: str
    timestamp: float


def as_trace_item_context(event_type: EventType, event: dict[str, Any]) -> TraceItemContext | None:
    """Returns a trace-item row or null for each event."""
    match event_type:
        case EventType.CLICK | EventType.DEAD_CLICK | EventType.RAGE_CLICK:
            payload = event["data"]["payload"]

            node = payload["data"]["node"]
            node_attributes = node.get("attributes", {})
            attributes = {
                "node_id": int(node["id"]),
                "tag": to_string(node["tagName"]),
                "text": to_string(node["textContent"][:1024]),
                "is_dead": event_type in (EventType.DEAD_CLICK, EventType.RAGE_CLICK),
                "is_rage": event_type == EventType.RAGE_CLICK,
                "selector": to_string(payload["message"]),
                "category": "click",
            }
            if "alt" in node_attributes:
                attributes["alt"] = to_string(node_attributes["alt"])
            if "aria-label" in node_attributes:
                attributes["aria_label"] = to_string(node_attributes["aria-label"])
            if "class" in node_attributes:
                attributes["class"] = to_string(node_attributes["class"])
            if "data-sentry-component" in node_attributes:
                attributes["component_name"] = to_string(node_attributes["data-sentry-component"])
            if "id" in node_attributes:
                attributes["id"] = to_string(node_attributes["id"])
            if "role" in node_attributes:
                attributes["role"] = to_string(node_attributes["role"])
            if "title" in node_attributes:
                attributes["title"] = to_string(node_attributes["title"])
            if _get_testid(node_attributes):
                attributes["testid"] = _get_testid(node_attributes)
            if "url" in payload:
                attributes["url"] = to_string(payload["url"])

            return {
                "attributes": attributes,
                "event_hash": uuid.uuid4().hex,
                "timestamp": float(payload["timestamp"]),
            }
        case EventType.NAVIGATION:
            payload = event["data"]["payload"]
            payload_data = payload["data"]

            attributes = {"category": "navigation"}
            if "from" in payload_data:
                attributes["from"] = to_string(payload_data["from"])
            if "to" in payload_data:
                attributes["to"] = to_string(payload_data["to"])

            return {
                "attributes": attributes,
                "event_hash": uuid.uuid4().hex,
                "timestamp": float(payload["timestamp"]),
            }
        case EventType.CONSOLE:
            return None
        case EventType.UI_BLUR:
            return None
        case EventType.UI_FOCUS:
            return None
        case EventType.RESOURCE_FETCH | EventType.RESOURCE_XHR:
            attributes = {
                "category": (
                    "resource.xhr" if event_type == EventType.RESOURCE_XHR else "resource.fetch"
                ),
            }

            request_size, response_size = parse_network_content_lengths(event)
            if request_size:
                attributes["request_size"] = request_size
            if response_size:
                attributes["response_size"] = response_size

            return {
                "attributes": attributes,
                "event_hash": uuid.uuid4().hex,
                "timestamp": float(event["data"]["payload"]["timestamp"]),
            }
        case EventType.LCP | EventType.FCP:
            payload = event["data"]["payload"]
            return {
                "attributes": {
                    "category": "web-vital.fcp" if event_type == EventType.FCP else "web-vital.lcp",
                    "rating": to_string(payload["data"]["rating"]),
                    "size": int(payload["data"]["size"]),
                    "value": int(payload["data"]["value"]),
                },
                "event_hash": uuid.uuid4().hex,
                "timestamp": float(payload["timestamp"]),
            }
        case EventType.HYDRATION_ERROR:
            payload = event["data"]["payload"]
            return {
                "attributes": {
                    "category": "replay.hydrate-error",
                    "url": to_string(payload["data"]["url"]),
                },
                "event_hash": uuid.uuid4().hex,
                "timestamp": float(event["data"]["payload"]["timestamp"]),
            }
        case EventType.MUTATIONS:
            payload = event["data"]["payload"]
            return {
                "attributes": {
                    "category": "replay.mutations",
                    "count": int(payload["data"]["count"]),
                },
                "event_hash": uuid.uuid4().hex,
                "timestamp": event["timestamp"],
            }
        case EventType.UNKNOWN:
            return None
        case EventType.CANVAS:
            return None
        case EventType.OPTIONS:
            payload = event["data"]["payload"]
            return {
                "attributes": {
                    "category": "sdk.options",
                    "shouldRecordCanvas": bool(payload["shouldRecordCanvas"]),
                    "sessionSampleRate": float(payload["sessionSampleRate"]),
                    "errorSampleRate": float(payload["errorSampleRate"]),
                    "useCompressionOption": bool(payload["useCompressionOption"]),
                    "blockAllMedia": bool(payload["blockAllMedia"]),
                    "maskAllText": bool(payload["maskAllText"]),
                    "maskAllInputs": bool(payload["maskAllInputs"]),
                    "useCompression": bool(payload["useCompression"]),
                    "networkDetailHasUrls": bool(payload["networkDetailHasUrls"]),
                    "networkCaptureBodies": bool(payload["networkCaptureBodies"]),
                    "networkRequestHasHeaders": bool(payload["networkRequestHasHeaders"]),
                    "networkResponseHasHeaders": bool(payload["networkResponseHasHeaders"]),
                },
                "event_hash": uuid.uuid4().hex,
                "timestamp": event["timestamp"] / 1000,
            }
        case EventType.FEEDBACK:
            return None
        case EventType.MEMORY:
            payload = event["data"]["payload"]
            return {
                "attributes": {
                    "category": "memory",
                    "jsHeapSizeLimit": int(payload["data"]["jsHeapSizeLimit"]),
                    "totalJSHeapSize": int(payload["data"]["totalJSHeapSize"]),
                    "usedJSHeapSize": int(payload["data"]["usedJSHeapSize"]),
                    "endTimestamp": float(payload["endTimestamp"]),
                },
                "event_hash": uuid.uuid4().hex,
                "timestamp": float(payload["startTimestamp"]),
            }


def to_string(value: Any) -> str:
    if isinstance(value, str):
        return value
    raise ValueError("Value was not a string.")


class HighlightedEvents(TypedDict, total=False):
    canvas_sizes: list[int]
    hydration_errors: list[HydrationError]
    mutations: list[MutationEvent]
    clicks: list[ClickEvent]
    request_response_sizes: list[tuple[int | None, int | None]]
    options: list[dict[str, Any]]


def parse_highlighted_events(events: list[dict[str, Any]], sampled: bool) -> ParsedEventMeta:
    """Return highlighted events which were parsed from the stream.

    Highlighted events are any event which is notable enough to be logged, used in a metric,
    emitted to a database, or otherwise emit an effect in some material way.
    """
    hes: HighlightedEvents = {
        "canvas_sizes": [],
        "clicks": [],
        "hydration_errors": [],
        "mutations": [],
        "options": [],
        "request_response_sizes": [],
    }

    for event in events:
        try:
            event_type = which(event)
        except (AssertionError, AttributeError, KeyError, TypeError):
            continue

        try:
            highlighted_event = as_highlighted_event(event, event_type)
        except (AssertionError, AttributeError, KeyError, TypeError):
            logger.info("Could not parse identified event.", exc_info=True)
            continue

        if highlighted_event is None:
            continue

        if "canvas_sizes" in highlighted_event and sampled:
            hes["canvas_sizes"].extend(highlighted_event["canvas_sizes"])
        if "hydration_errors" in highlighted_event:
            hes["hydration_errors"].extend(highlighted_event["hydration_errors"])
        if "mutations" in highlighted_event and sampled:
            hes["mutations"].extend(highlighted_event["mutations"])
        if "clicks" in highlighted_event:
            hes["clicks"].extend(highlighted_event["clicks"])
        if "request_response_sizes" in highlighted_event:
            hes["request_response_sizes"].extend(highlighted_event["request_response_sizes"])
        if "options" in highlighted_event and sampled:
            hes["options"].extend(highlighted_event["options"])

    return ParsedEventMeta(
        hes["canvas_sizes"],
        hes["clicks"],
        hes["hydration_errors"],
        hes["mutations"],
        hes["options"],
        hes["request_response_sizes"],
    )


def as_highlighted_event(event: dict[str, Any], event_type: EventType) -> HighlightedEvents | None:
    """Transform an event to a HighlightEvent or return None."""
    if event_type == EventType.CANVAS:
        return {"canvas_sizes": [len(json.dumps(event))]}
    elif event_type == EventType.HYDRATION_ERROR:
        timestamp = event["data"]["payload"]["timestamp"]
        url = event["data"]["payload"].get("data", {}).get("url")
        return {"hydration_errors": [HydrationError(timestamp=timestamp, url=url)]}
    elif event_type == EventType.MUTATIONS:
        return {"mutations": [MutationEvent(event["data"]["payload"])]}
    elif event_type == EventType.CLICK:
        click = parse_click_event(event["data"]["payload"], is_dead=False, is_rage=False)
        return {"clicks": [click]}
    elif event_type == EventType.DEAD_CLICK:
        click = parse_click_event(event["data"]["payload"], is_dead=True, is_rage=False)
        return {"clicks": [click]}
    elif event_type == EventType.RAGE_CLICK:
        click = parse_click_event(event["data"]["payload"], is_dead=True, is_rage=True)
        return {"clicks": [click]}
    elif event_type == EventType.RESOURCE_FETCH or event_type == EventType.RESOURCE_XHR:
        lengths = parse_network_content_lengths(event)
        if lengths != (None, None):
            return {"request_response_sizes": [lengths]}
    elif event_type == EventType.OPTIONS:
        return {"options": [event]}

    return None


def parse_network_content_lengths(event: dict[str, Any]) -> tuple[int | None, int | None]:
    def _get_request_size(data: dict[str, Any]) -> int:
        if "requestBodySize" in data:  # 7.44 and 7.45
            return int(data["requestBodySize"])
        else:
            return int(data["request"]["size"])

    def _get_response_size(data: dict[str, Any]) -> int:
        if "responseBodySize" in data:  # 7.44 and 7.45
            return int(data["responseBodySize"])
        else:
            return int(data["response"]["size"])

    event_payload_data = event["data"]["payload"].get("data")
    if not isinstance(event_payload_data, dict):
        return (None, None)

    try:
        request_size = _get_request_size(event_payload_data)
    except (AttributeError, KeyError, TypeError, ValueError):
        request_size = None

    try:
        response_size = _get_response_size(event_payload_data)
    except (AttributeError, KeyError, TypeError, ValueError):
        response_size = None

    return request_size, response_size


def parse_click_event(payload: dict[str, Any], is_dead: bool, is_rage: bool) -> ClickEvent:
    node = payload["data"]["node"]
    assert node is not None
    assert node["id"] >= 0

    attributes = node.get("attributes", {})

    return ClickEvent(
        alt=attributes.get("alt", "")[:64],
        aria_label=attributes.get("aria-label", "")[:64],
        classes=_parse_classes(attributes.get("class", "")),
        component_name=attributes.get("data-sentry-component", "")[:64],
        id=attributes.get("id", "")[:64],
        is_dead=int(is_dead),
        is_rage=int(is_rage),
        node_id=node["id"],
        role=attributes.get("role", "")[:32],
        selector=payload["message"],
        tag=node["tagName"][:32],
        testid=_get_testid(attributes)[:64],
        text=node["textContent"][:1024],
        timestamp=int(payload["timestamp"]),
        title=attributes.get("title", "")[:64],
        url=payload["data"].get("url"),
    )


def _parse_classes(classes: Any) -> list[str]:
    return (
        list(filter(lambda class_: class_ != "", classes.split(" ")))[:10]
        if isinstance(classes, str)
        else []
    )


def _get_testid(container: dict[str, Any]) -> str:
    result = (
        container.get("testId")
        or container.get("data-testid")
        or container.get("data-test-id")
        or ""
    )
    return result if isinstance(result, str) else ""
