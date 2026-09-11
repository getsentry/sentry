from typing import NotRequired, TypedDict

from sentry.search.eap.trace_metrics.types import TraceMetricType


class TraceMetricContext(TypedDict):
    brief: NotRequired[str]
    # Longer-form notes, normalized to a list to match the attributes context
    # shape (see TraceItemAttributeContext.details).
    details: NotRequired[list[str]]


class TraceMetricItem(TypedDict):
    name: str
    type: TraceMetricType
    unit: str | None
    # The EAP aggregate declares an integer search type but the value arrives as
    # a float, so declare what is actually emitted.
    count: float
    lastSeen: float | None
    # Only present when `expand=context` is requested and the
    # data-browsing-attribute-context feature is enabled.
    context: NotRequired[TraceMetricContext]
