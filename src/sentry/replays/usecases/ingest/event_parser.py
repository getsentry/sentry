from __future__ import annotations

import random
from dataclasses import dataclass
from enum import Enum
from typing import Any
from urllib.parse import urlparse

import sentry_sdk

from sentry.utils import json


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
    return _parse_events(events, sampled=random.randint(0, 499) < 1)


def _parse_events(events: list[dict[str, Any]], sampled: bool) -> ParsedEventMeta:
    """Return a list of ClickEvent types.

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
    canvas_sizes = []
    click_events = []
    hydration_errors = []
    mutation_events = []
    options_events = []
    request_response_sizes = []

    for event in events:
        event_type = event.get("type")
        if event_type == 3:
            if event.get("data", {}).get("source") == 9 and sampled:
                canvas_sizes.append(len(json.dumps(event)))
            continue
        elif event_type != 5:
            continue

        tag = event.get("data", {}).get("tag")
        if tag == "breadcrumb":
            result = _get_breadcrumb_event(event, sampled=sampled)
            if isinstance(result, HydrationError):
                hydration_errors.append(result)
            elif isinstance(result, MutationEvent):
                mutation_events.append(result)
            elif isinstance(result, ClickEvent):
                click_events.append(result)
        elif tag == "performanceSpan":
            sizes = _get_request_response_sizes(event)
            if sizes:
                request_response_sizes.append(sizes)
        elif tag == "options" and sampled:
            options_events.append(event)

    return ParsedEventMeta(
        canvas_sizes,
        click_events,
        hydration_errors,
        mutation_events,
        options_events,
        request_response_sizes,
    )


def _create_click_event(payload: dict[str, Any], is_dead: bool, is_rage: bool) -> ClickEvent | None:
    node = payload.get("data", {}).get("node")
    if node is None or node["id"] < 0:
        return None

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


def _parse_classes(classes: str) -> list[str]:
    return list(filter(lambda n: n != "", classes.split(" ")))[:10]


def _get_testid(container: dict[str, str]) -> str:
    return (
        container.get("testId")
        or container.get("data-testid")
        or container.get("data-test-id")
        or ""
    )


def _get_request_response_sizes(event: dict[str, Any]) -> tuple[Any, Any] | None:
    if event["data"].get("payload", {}).get("op") not in ("resource.fetch", "resource.xhr"):
        return None

    event_payload_data = event["data"]["payload"].get("data")
    if not isinstance(event_payload_data, dict):
        return None

    if "requestBodySize" in event_payload_data:  # 7.44 and 7.45
        request_size = event_payload_data["requestBodySize"]
    elif request := event_payload_data.get("request"):
        if isinstance(request, dict) and "size" in request:
            request_size = request["size"]
        else:
            request_size = None
    else:
        request_size = None

    if "responseBodySize" in event_payload_data:  # 7.44 and 7.45
        response_size = event_payload_data["responseBodySize"]
    elif response := event_payload_data.get("response"):
        if isinstance(response, dict) and "size" in response:
            response_size = response["size"]
        else:
            response_size = None
    else:
        response_size = None

    result = (request_size, response_size)
    if result == (None, None):
        return None
    else:
        return result


def _get_breadcrumb_event(
    event: dict[str, Any], sampled: bool
) -> HydrationError | MutationEvent | ClickEvent | None:
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

        click = None
        if is_timeout_reason and is_target_tagname and timeout >= 7000:
            is_rage = (
                payload["data"].get("clickCount", 0) or payload["data"].get("clickcount", 0)
            ) >= 5
            click = _create_click_event(payload, is_dead=True, is_rage=is_rage)
        return click
    elif category == "ui.click":
        return _create_click_event(payload, is_dead=False, is_rage=False)
    elif category == "replay.hydrate-error":
        return HydrationError(
            timestamp=payload["timestamp"], url=payload.get("data", {}).get("url")
        )
    elif category == "replay.mutations" and sampled:
        return MutationEvent(payload)
    else:
        return None


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
    USER_FEEDBACK = 13
    ERROR = 14
    UNKNOWN = 15


def which(event: dict[str, Any]) -> EventType:
    """Identify the passed event.

    This function helpfully hides the dirty data munging necessary to identify an event type and
    helpfully reduces the number of operations required by reusing context from previous
    branches.
    """
    # These two cases are derived specificlly for the replay summarize breadcrumbs endpoint,
    # which combines error and breadcrumb events into a single context for LLM.
    # Error and user feedback events are not ingested the same way as other breadcrumbs.
    if event.get("category") == "feedback":
        return EventType.USER_FEEDBACK
    elif event.get("category") == "error":
        return EventType.ERROR

    if event.get("type") == 5:
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
                        payload["data"].get("clickCount", 0) or payload["data"].get("clickcount", 0)
                    ) >= 5
                    if is_rage:
                        return EventType.RAGE_CLICK
                    else:
                        return EventType.DEAD_CLICK
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

            # Safely get (request_size, response_size)
            sizes_tuple = _get_request_response_sizes(event)
            response_size = None

            # Check if the tuple is valid and response size exists
            if sizes_tuple and sizes_tuple[1] is not None:
                response_size = str(sizes_tuple[1])

            status_code = payload["data"]["statusCode"]
            duration = payload["endTimestamp"] - payload["startTimestamp"]
            method = payload["data"]["method"]

            if response_size is None:
                return f'Application initiated request: "{method} {path} HTTP/2.0" with status code {status_code}; took {duration} milliseconds at {timestamp}'
            else:
                return f'Application initiated request: "{method} {path} HTTP/2.0" with status code {status_code} and response size {response_size}; took {duration} milliseconds at {timestamp}'
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
        case EventType.USER_FEEDBACK:
            message = event["message"]
            return f"User gave feedback: '{message}' on the product at {timestamp}"
        case EventType.ERROR:
            message = event["message"]
            title = event["title"]
            return f"User experienced an error: '{title}: {message}' at {timestamp}"
        case EventType.UNKNOWN:
            return None
