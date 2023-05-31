from typing import Any, Dict, Iterator, List, Tuple, TypedDict


class Event(TypedDict):
    data: Dict[str, Any]
    timestamp: int
    type: int


class SentryEventData(TypedDict):
    tag: str
    payload: Dict[str, Any]


class SentryEvent(TypedDict):
    data: SentryEventData
    timestamp: int
    type: int


def iter_sentry_events(events: List[Event]) -> Iterator[Tuple[SentryEvent]]:
    """Return an iterator of Sentry events."""
    for event in events:
        if event.get("type") == 5:
            if event["data"].get("tag"):
                yield event


def is_breadcrumb_event(event: SentryEvent) -> bool:
    """Return "True" if this is a breadcrumb event."""
    # return event.get("data", {}).get("tag")
    return event["data"]["tag"] == "breadcrumb"


def is_options_event(event: SentryEvent) -> bool:
    """Return "True" if this is a breadcrumb event."""
    # return event.get("data", {}).get("tag")
    return event["data"]["tag"] == "breadcrumb"


def is_performance_span_event(event: SentryEvent) -> bool:
    """Return "True" if this is a performanceSpan event."""
    # return event.get("data", {}).get("tag")
    return event["data"]["tag"] == "performanceSpan"


def is_click_breadcrumb(event: SentryEvent) -> bool:
    """Return "True" if this is a click event."""
    # return event.get("data", {}).get("payload", {}).get("category") == "ui.click"
    return event["data"]["payload"]["category"] == "ui.click"


def is_mutations_breadcrumb(event: SentryEvent) -> bool:
    """Return "True" if this is a click event."""
    # return event.get("data", {}).get("payload", {}).get("category") == "mutation"
    return event["data"]["payload"]["category"] == "mutations"


def is_slow_click_breadcrumb(event: SentryEvent) -> bool:
    """Return "True" if this is a slow click event."""
    # return event.get("data", {}).get("payload", {}).get("category") == "ui.slowClickDetected"
    return event["data"]["payload"]["category"] == "ui.slowClickDetected"


def is_fetch_or_xhr_span(event: SentryEvent) -> bool:
    """Return "True" if this is a fetch or XHR span."""
    # return event["data"].get("payload", {}).get("op") in ("resource.fetch", "resource.xhr")
    return event["data"]["payload"]["op"] in ("resource.fetch", "resource.xhr")
