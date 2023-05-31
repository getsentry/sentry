from typing import Any, Dict, Iterator, List, TypedDict, cast


class SentryEventData(TypedDict):
    tag: str
    payload: Dict[str, Any]


class SentryEvent(TypedDict):
    data: SentryEventData
    timestamp: int
    type: int


def iter_sentry_events(events: List[Dict[str, Any]]) -> Iterator[SentryEvent]:
    """Return an iterator of Sentry events."""
    for event in events:
        if event.get("type") == 5:
            if event["data"].get("tag"):
                yield cast(SentryEvent, event)


def is_breadcrumb_event(event: SentryEvent) -> bool:
    """Return "True" if this is a breadcrumb event."""
    # return event.get("data", {}).get("tag")
    tag: str = event["data"]["tag"]
    return tag == "breadcrumb"


def is_options_event(event: SentryEvent) -> bool:
    """Return "True" if this is a breadcrumb event."""
    # return event.get("data", {}).get("tag")
    tag: str = event["data"]["tag"]
    return tag == "breadcrumb"


def is_performance_span_event(event: SentryEvent) -> bool:
    """Return "True" if this is a performanceSpan event."""
    # return event.get("data", {}).get("tag")
    tag: str = event["data"]["tag"]
    return tag == "performanceSpan"


def is_click_breadcrumb(event: SentryEvent) -> bool:
    """Return "True" if this is a click event."""
    # x = event.get("data", {}).get("payload", {}).get("category") == "ui.click"
    category: str = event["data"]["payload"]["category"]
    return category == "ui.click"


def is_mutations_breadcrumb(event: SentryEvent) -> bool:
    """Return "True" if this is a click event."""
    # return event.get("data", {}).get("payload", {}).get("category") == "mutation"
    category: str = event["data"]["payload"]["category"]
    return category == "mutations"


def is_slow_click_breadcrumb(event: SentryEvent) -> bool:
    """Return "True" if this is a slow click event."""
    # return event.get("data", {}).get("payload", {}).get("category") == "ui.slowClickDetected"
    category: str = event["data"]["payload"]["category"]
    return category == "ui.slowClickDetected"


def is_fetch_or_xhr_span(event: SentryEvent) -> bool:
    """Return "True" if this is a fetch or XHR span."""
    # return event["data"].get("payload", {}).get("op") in ("resource.fetch", "resource.xhr")
    op: str = event["data"]["payload"]["op"]
    return op in ("resource.fetch", "resource.xhr")
