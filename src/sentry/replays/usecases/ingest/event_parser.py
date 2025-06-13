from __future__ import annotations

import logging
import random
from dataclasses import dataclass
from enum import Enum
from typing import Any, TypedDict
from urllib.parse import urlparse

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
    FEEDBACK = 14
    CANVAS = 15
    OPTIONS = 16


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
                elif category == "sentry.feedback":
                    return EventType.FEEDBACK
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


def as_log_message(event: dict[str, Any]) -> str | None:
    """Return an event as a log message.

    Useful in AI contexts where the event's structure is an impediment to the AI's understanding
    of the interaction log. Not every event produces a log message. This function is overly coupled
    to the AI use case. In later iterations, if more or all log messages are desired, this function
    should be forked.
    """
    event_type = which(event)
    timestamp = event.get("timestamp", 0.0)

    match event_type:
        case EventType.CLICK:
            return f"User clicked on {event["data"]["payload"]["message"]} at {timestamp}"
        case EventType.DEAD_CLICK:
            return f"User clicked on {event["data"]["payload"]["message"]} but the triggered action was slow to complete at {timestamp}"
        case EventType.RAGE_CLICK:
            return f"User rage clicked on {event["data"]["payload"]["message"]} but the triggered action was slow to complete at {timestamp}"
        case EventType.NAVIGATION:
            return f"User navigated to: {event["data"]["payload"]["data"]["to"]} at {timestamp}"
        case EventType.CONSOLE:
            return f"Logged: {event["data"]["payload"]["message"]} at {timestamp}"
        case EventType.UI_BLUR:
            return f"User looked away from the tab at {timestamp}."
        case EventType.UI_FOCUS:
            return f"User returned to tab at {timestamp}."
        case EventType.RESOURCE_FETCH:
            payload = event["data"]["payload"]
            parsed_url = urlparse(payload["description"])

            path = f"{parsed_url.path}?{parsed_url.query}"
            size = payload["data"]["response"]["size"]
            status_code = payload["data"]["statusCode"]
            duration = payload["endTimestamp"] - payload["startTimestamp"]
            method = payload["data"]["method"]
            return f'Application initiated request: "{method} {path} HTTP/2.0" {status_code} {size}; took {duration} milliseconds at {timestamp}'
        case EventType.RESOURCE_XHR:
            return None
        case EventType.LCP:
            duration = event["data"]["payload"]["data"]["size"]
            rating = event["data"]["payload"]["data"]["rating"]
            return f"Application largest contentful paint: {duration} ms and has a {rating} rating"
        case EventType.FCP:
            duration = event["data"]["payload"]["data"]["size"]
            rating = event["data"]["payload"]["data"]["rating"]
            return f"Application first contentful paint: {duration} ms and has a {rating} rating"
        case EventType.HYDRATION_ERROR:
            return f"There was a hydration error on the page at {timestamp}."
        case EventType.MUTATIONS:
            return None
        case EventType.UNKNOWN:
            return None
        case EventType.FEEDBACK:
            return "The user filled out a feedback form describing their experience using the application."
        case EventType.CANVAS:
            return None
        case EventType.OPTIONS:
            return None


class HighlightedEvents(TypedDict, total=False):
    canvas_sizes: list[int]
    hydration_errors: list[HydrationError]
    mutations: list[MutationEvent]
    clicks: list[ClickEvent]
    request_response_sizes: list[tuple[int | None, int | None]]
    options: list[dict[str, Any]]


def parse_highlighted_events(events: list[dict[str, Any]], sampled: bool) -> ParsedEventMeta:
    """Return highlighted events which were parsed from the stream."""
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
