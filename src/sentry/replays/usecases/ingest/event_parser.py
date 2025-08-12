from __future__ import annotations

import logging
import random
import uuid
from collections.abc import Callable, Iterator, MutableMapping
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Literal, TypedDict, TypeVar

import sentry_sdk
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry import options
from sentry.logging.handlers import SamplingFilter
from sentry.replays.lib.eap.write import new_trace_item
from sentry.utils import json

logger = logging.getLogger("sentry.replays.event_parser")
logger.addFilter(SamplingFilter(0.001))


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


class EventContext(TypedDict):
    organization_id: int
    project_id: int
    received: float
    retention_days: int
    trace_id: str | None
    replay_id: str
    segment_id: int


@sentry_sdk.trace
def parse_events(
    context: EventContext, events: list[dict[str, Any]]
) -> tuple[ParsedEventMeta, list[TraceItem]]:
    sampled = random.randint(0, 499) < 1

    eap_builder = EAPEventsBuilder(context)
    hev_builder = HighlightedEventsBuilder()

    for event_type, event in which_iter(events):
        eap_builder.add(event_type, event, sampled=random.random())
        hev_builder.add(event_type, event, sampled)

    return (hev_builder.result, eap_builder.result)


class EventType(Enum):
    CANVAS = 0
    CLICK = 1
    CONSOLE = 2
    DEAD_CLICK = 3
    # FCP = 4 deprecated
    FEEDBACK = 5
    HYDRATION_ERROR = 6
    LCP = 7
    MEMORY = 8
    MUTATIONS = 9
    NAVIGATION = 10
    OPTIONS = 11
    RAGE_CLICK = 12
    RESOURCE_FETCH = 13
    RESOURCE_IMAGE = 14
    RESOURCE_SCRIPT = 15
    RESOURCE_XHR = 16
    SLOW_CLICK = 17
    UI_BLUR = 18
    UI_FOCUS = 19
    UNKNOWN = 20
    CLS = 21
    NAVIGATION_SPAN = 22


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
                        return EventType.SLOW_CLICK
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
                if op.startswith("navigation"):
                    return EventType.NAVIGATION_SPAN
                if op == "resource.fetch":
                    return EventType.RESOURCE_FETCH
                elif op == "resource.xhr":
                    return EventType.RESOURCE_XHR
                elif op == "resource.script":
                    return EventType.RESOURCE_SCRIPT
                elif op == "resource.img":
                    return EventType.RESOURCE_IMAGE
                elif op == "web-vital":
                    if payload["description"] == "largest-contentful-paint":
                        return EventType.LCP
                    elif payload["description"] == "cumulative-layout-shift":
                        return EventType.CLS
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


def get_timestamp_unit(event_type: EventType) -> Literal["s", "ms"]:
    """
    Returns the time unit of event["timestamp"] for a replay event.
    This is not guaranteed to match event.data.payload.timestamp.

    We do not allow wildcard or default cases. Please be explicit when adding new types.
    Beware that EventType.UNKNOWN returns "ms" but there's no way to know the actual unit.
    """
    match event_type:
        case (
            EventType.CLS
            | EventType.LCP
            | EventType.FEEDBACK
            | EventType.MEMORY
            | EventType.MUTATIONS
            | EventType.NAVIGATION_SPAN
            | EventType.RESOURCE_FETCH
            | EventType.RESOURCE_IMAGE
            | EventType.RESOURCE_SCRIPT
            | EventType.RESOURCE_XHR
            | EventType.UI_BLUR
            | EventType.UI_FOCUS
        ):
            return "s"
        case (
            EventType.CANVAS
            | EventType.CONSOLE
            | EventType.CLICK
            | EventType.DEAD_CLICK
            | EventType.RAGE_CLICK
            | EventType.SLOW_CLICK
            | EventType.HYDRATION_ERROR
            | EventType.NAVIGATION
            | EventType.OPTIONS
            | EventType.UNKNOWN
        ):
            return "ms"


def get_timestamp_ms(event: dict[str, Any], event_type: EventType) -> float:
    if get_timestamp_unit(event_type) == "s":
        return event.get("timestamp", 0) * 1000
    return event.get("timestamp", 0)


#
# EAP Trace Item Processor
#


class EAPEventsBuilder:

    def __init__(self, context: EventContext):
        self.context = context
        self.events: list[TraceItem] = []

    def add(self, event_type: EventType, event: dict[str, Any], sampled: float) -> None:
        if sampled and sampled <= options.get("replay.recording.ingest-trace-items.rollout"):
            trace_item = parse_trace_item(self.context, event_type, event)
            if trace_item:
                self.events.append(trace_item)

    @property
    def result(self) -> list[TraceItem]:
        return self.events


def parse_trace_item(
    context: EventContext, event_type: EventType, event: dict[str, Any]
) -> TraceItem | None:
    try:
        return as_trace_item(context, event_type, event)
    except (AttributeError, KeyError, TypeError, ValueError) as e:
        logger.warning(
            "[EVENT PARSE FAIL] Could not transform breadcrumb to trace-item",
            exc_info=e,
            extra={"event": event},
        )
        return None


def as_trace_item(
    context: EventContext, event_type: EventType, event: dict[str, Any]
) -> TraceItem | None:
    # Not every event produces a trace-item.
    trace_item_context = as_trace_item_context(event_type, event)
    if not trace_item_context:
        return None

    # Extend the attributes with the replay_id to make it queryable by replay_id after we
    # eventually use the trace_id in its rightful position.
    trace_item_context["attributes"]["replay_id"] = context["replay_id"]

    return new_trace_item(
        {
            "attributes": trace_item_context["attributes"],  # type: ignore[typeddict-item]
            "client_sample_rate": 1.0,
            "organization_id": context["organization_id"],
            "project_id": context["project_id"],
            "received": datetime.fromtimestamp(int(context["received"])),
            "retention_days": context["retention_days"],
            "server_sample_rate": 1.0,
            "timestamp": datetime.fromtimestamp(int(trace_item_context["timestamp"] * 1000) / 1000),
            "trace_id": context["trace_id"] or context["replay_id"],
            "trace_item_id": trace_item_context["event_hash"],
            "trace_item_type": "replay",
        }
    )


class TraceItemContext(TypedDict):
    attributes: MutableMapping[str, str | int | bool | float]
    event_hash: bytes
    timestamp: float


def as_trace_item_context(event_type: EventType, event: dict[str, Any]) -> TraceItemContext | None:
    """Returns a trace-item row or null for each event."""
    match event_type:
        case EventType.CLICK | EventType.DEAD_CLICK | EventType.RAGE_CLICK | EventType.SLOW_CLICK:
            payload = event["data"]["payload"]

            # If the node wasn't provided we're forced to skip the event.
            if "node" not in payload["data"]:
                return None

            node = payload["data"]["node"]
            node_attributes = node.get("attributes", {})
            click_attributes = {
                "node_id": int(node["id"]),
                "tag": as_string_strict(node["tagName"]),
                "text": as_string_strict(node["textContent"][:1024]),
                "is_dead": event_type in (EventType.DEAD_CLICK, EventType.RAGE_CLICK),
                "is_rage": event_type == EventType.RAGE_CLICK,
                "selector": as_string_strict(payload["message"]),
                "category": "ui.click",
            }
            if "alt" in node_attributes:
                click_attributes["alt"] = as_string_strict(node_attributes["alt"])
            if "aria-label" in node_attributes:
                click_attributes["aria_label"] = as_string_strict(node_attributes["aria-label"])
            if "class" in node_attributes:
                click_attributes["class"] = as_string_strict(node_attributes["class"])
            if "data-sentry-component" in node_attributes:
                click_attributes["component_name"] = as_string_strict(
                    node_attributes["data-sentry-component"]
                )
            if "id" in node_attributes:
                click_attributes["id"] = as_string_strict(node_attributes["id"])
            if "role" in node_attributes:
                click_attributes["role"] = as_string_strict(node_attributes["role"])
            if "title" in node_attributes:
                click_attributes["title"] = as_string_strict(node_attributes["title"])
            if _get_testid(node_attributes):
                click_attributes["testid"] = _get_testid(node_attributes)
            if "url" in payload:
                click_attributes["url"] = as_string_strict(payload["url"])

            return {
                "attributes": click_attributes,  # type: ignore[typeddict-item]
                "event_hash": uuid.uuid4().bytes,
                "timestamp": float(payload["timestamp"]),
            }
        case EventType.NAVIGATION:
            payload = event["data"]["payload"]
            payload_data = payload.get("data", {})

            navigation_attributes = {"category": "navigation"}
            if "from" in payload_data:
                navigation_attributes["from"] = as_string_strict(payload_data["from"])
            if "to" in payload_data:
                navigation_attributes["to"] = as_string_strict(payload_data["to"])

            return {
                "attributes": navigation_attributes,  # type: ignore[typeddict-item]
                "event_hash": uuid.uuid4().bytes,
                "timestamp": float(payload["timestamp"]),
            }
        case EventType.CONSOLE:
            return None
        case EventType.UI_BLUR:
            return None
        case EventType.UI_FOCUS:
            return None
        case EventType.RESOURCE_FETCH | EventType.RESOURCE_XHR:
            payload = event["data"]["payload"]

            resource_attributes = {
                "category": (
                    "resource.xhr" if event_type == EventType.RESOURCE_XHR else "resource.fetch"
                ),
                "url": as_string_strict(payload["description"]),
                "method": str(payload["data"]["method"]),
                "duration": float(payload["endTimestamp"]) - float(payload["startTimestamp"]),
            }

            if "statusCode" in payload["data"]:
                resource_attributes["statusCode"] = int(payload["data"]["statusCode"])

            for key, value in payload["data"].get("request", {}).get("headers", {}).items():
                resource_attributes[f"request.headers.{key}"] = str(value)

            for key, value in payload["data"].get("response", {}).get("headers", {}).items():
                resource_attributes[f"response.headers.{key}"] = str(value)

            request_size, response_size = parse_network_content_lengths(event)
            if request_size:
                resource_attributes["request_size"] = request_size
            if response_size:
                resource_attributes["response_size"] = response_size

            return {
                "attributes": resource_attributes,
                "event_hash": uuid.uuid4().bytes,
                "timestamp": float(payload["startTimestamp"]),
            }
        case EventType.RESOURCE_SCRIPT | EventType.RESOURCE_IMAGE:
            payload = event["data"]["payload"]
            payload_data = payload.get("data", {})

            return {
                "attributes": {
                    "category": (
                        "resource.script"
                        if event_type == EventType.RESOURCE_SCRIPT
                        else "resource.img"
                    ),
                    "url": as_string_strict(payload["description"]),
                    "duration": float(payload["endTimestamp"]) - float(payload["startTimestamp"]),
                    # Optional fields are extracted safely but type coerced strictly.
                    **set_if(
                        ["size", "statusCode", "decodedBodySize", "encodedBodySize"],
                        payload_data,
                        int,
                    ),
                },
                "event_hash": uuid.uuid4().bytes,
                "timestamp": float(event["data"]["payload"]["startTimestamp"]),
            }
        case EventType.LCP | EventType.CLS:
            payload = event["data"]["payload"]

            if event_type == EventType.CLS:
                category = "web-vital.cls"
            else:
                category = "web-vital.lcp"

            return {
                "attributes": {
                    "category": category,
                    "duration": float(event["data"]["payload"]["endTimestamp"])
                    - float(event["data"]["payload"]["startTimestamp"]),
                    "rating": as_string_strict(payload["data"]["rating"]),
                    "size": float(payload["data"]["size"]),
                    "value": float(payload["data"]["value"]),
                },
                "event_hash": uuid.uuid4().bytes,
                "timestamp": float(payload["startTimestamp"]),
            }
        case EventType.HYDRATION_ERROR:
            payload = event["data"]["payload"]
            payload_data = payload.get("data", {})
            return {
                "attributes": {
                    "category": "replay.hydrate-error",
                    "url": as_string_strict(payload_data.get("url", "")),
                },
                "event_hash": uuid.uuid4().bytes,
                "timestamp": float(event["data"]["payload"]["timestamp"]),
            }
        case EventType.MUTATIONS:
            payload = event["data"]["payload"]
            return {
                "attributes": {
                    "category": "replay.mutations",
                    "count": int(payload["data"]["count"]),
                },
                "event_hash": uuid.uuid4().bytes,
                "timestamp": event["timestamp"],
            }
        case EventType.UNKNOWN:
            return None
        case EventType.CANVAS:
            return None
        case EventType.OPTIONS:
            payload = event["data"].get("payload", {})
            return {
                "attributes": {
                    "category": "sdk.options",
                    **set_if(
                        [
                            "shouldRecordCanvas",
                            "useCompressionOption",
                            "blockAllMedia",
                            "maskAllText",
                            "maskAllInputs",
                            "useCompression",
                            "networkDetailHasUrls",
                            "networkCaptureBodies",
                            "networkRequestHasHeaders",
                            "networkResponseHasHeaders",
                        ],
                        payload,
                        bool,
                    ),
                    **set_if(
                        [
                            "sessionSampleRate",
                            "errorSampleRate",
                        ],
                        payload,
                        float,
                    ),
                },
                "event_hash": uuid.uuid4().bytes,
                "timestamp": event["timestamp"] / 1000,
            }
        case EventType.FEEDBACK:
            return None
        case EventType.MEMORY:
            payload = event["data"]["payload"]
            return {
                "attributes": {
                    "category": "memory",
                    "jsHeapSizeLimit": int(payload["data"]["memory"]["jsHeapSizeLimit"]),
                    "totalJSHeapSize": int(payload["data"]["memory"]["totalJSHeapSize"]),
                    "usedJSHeapSize": int(payload["data"]["memory"]["usedJSHeapSize"]),
                    "endTimestamp": float(payload["endTimestamp"]),
                    "duration": float(event["data"]["payload"]["endTimestamp"])
                    - float(event["data"]["payload"]["startTimestamp"]),
                },
                "event_hash": uuid.uuid4().bytes,
                "timestamp": float(payload["startTimestamp"]),
            }
        case EventType.NAVIGATION_SPAN:
            return None


def as_string_strict(value: Any) -> str:
    if isinstance(value, str):
        return value
    raise ValueError("Value was not a string.")


T = TypeVar("T")


def set_if(keys: list[str], data: dict[str, Any], value_fn: Callable[[Any], T]) -> dict[str, T]:
    return {key: value_fn(data[key]) for key in keys if key in data}


#
# Highlighted Event Processor
#


class HighlightedEvents(TypedDict, total=False):
    canvas_sizes: list[int]
    hydration_errors: list[HydrationError]
    mutations: list[MutationEvent]
    clicks: list[ClickEvent]
    request_response_sizes: list[tuple[int | None, int | None]]
    options: list[dict[str, Any]]


class HighlightedEventsBuilder:

    def __init__(self):
        self.events: HighlightedEvents = {
            "canvas_sizes": [],
            "clicks": [],
            "hydration_errors": [],
            "mutations": [],
            "options": [],
            "request_response_sizes": [],
        }

    def add(self, event_type: EventType, event: dict[str, Any], sampled: bool) -> None:
        for k, v in parse_highlighted_event(event_type, event, sampled).items():
            self.events[k].extend(v)  # type: ignore[literal-required]

    @property
    def result(self) -> ParsedEventMeta:
        return ParsedEventMeta(
            self.events["canvas_sizes"],
            self.events["clicks"],
            self.events["hydration_errors"],
            self.events["mutations"],
            self.events["options"],
            self.events["request_response_sizes"],
        )


def parse_highlighted_event(
    event_type: EventType, event: dict[str, Any], sampled: bool
) -> HighlightedEvents:
    """Attempt to parse an event to a highlighted event."""
    try:
        return as_highlighted_event(event, event_type, sampled)
    except (AssertionError, AttributeError, KeyError, TypeError):
        logger.warning(
            "[EVENT PARSE FAIL] Could not parse identified event.",
            exc_info=True,
            extra={"event": event},
        )
        return {}


def as_highlighted_event(
    event: dict[str, Any], event_type: EventType, sampled: bool
) -> HighlightedEvents:
    """Transform an event to a HighlightEvent or return None."""
    if event_type == EventType.CANVAS and sampled:
        return {"canvas_sizes": [len(json.dumps(event))]}
    elif event_type == EventType.HYDRATION_ERROR:
        timestamp = event["data"]["payload"]["timestamp"]
        url = event["data"]["payload"].get("data", {}).get("url")
        return {"hydration_errors": [HydrationError(timestamp=timestamp, url=url)]}
    elif event_type == EventType.MUTATIONS and sampled:
        return {"mutations": [MutationEvent(event["data"]["payload"])]}
    elif event_type == EventType.CLICK or event_type == EventType.SLOW_CLICK:
        click = parse_click_event(event["data"]["payload"], is_dead=False, is_rage=False)
        return {"clicks": [click]} if click else {}
    elif event_type == EventType.DEAD_CLICK:
        click = parse_click_event(event["data"]["payload"], is_dead=True, is_rage=False)
        return {"clicks": [click]} if click else {}
    elif event_type == EventType.RAGE_CLICK:
        click = parse_click_event(event["data"]["payload"], is_dead=True, is_rage=True)
        return {"clicks": [click]} if click else {}
    elif event_type == EventType.RESOURCE_FETCH or event_type == EventType.RESOURCE_XHR:
        lengths = parse_network_content_lengths(event)
        if lengths != (None, None):
            return {"request_response_sizes": [lengths]}
        else:
            return {}
    elif event_type == EventType.OPTIONS and sampled:
        return {"options": [event]}
    else:
        return {}


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


def parse_click_event(payload: dict[str, Any], is_dead: bool, is_rage: bool) -> ClickEvent | None:
    node = payload["data"].get("node")

    if not isinstance(node, dict) or node.get("id", -1) < 0:
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
