from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Any

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
