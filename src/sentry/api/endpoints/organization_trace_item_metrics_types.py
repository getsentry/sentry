from typing import Annotated, NotRequired, TypedDict

from sentry.apidocs.descriptions import ApiDescription
from sentry.search.eap.trace_metrics.types import TraceMetricType


class TraceMetricContext(TypedDict):
    brief: NotRequired[Annotated[str, ApiDescription("Short description of the metric")]]
    # Longer-form notes, normalized to a list to match the attributes context
    # shape (see TraceItemAttributeContext.details).
    details: NotRequired[Annotated[list[str], ApiDescription("Longer notes about the metric")]]


class TraceMetricItem(TypedDict):
    name: Annotated[str, ApiDescription("Name of the metric")]
    type: Annotated[
        TraceMetricType, ApiDescription("Type of the metric: counter, gauge or distribution")
    ]
    unit: Annotated[str | None, ApiDescription("Unit of the metric. Null when it has none")]
    # The EAP aggregate declares an integer search type but the value arrives as
    # a float, so declare what is actually emitted.
    count: Annotated[float, ApiDescription("Number of data points of the metric in the time range")]
    lastSeen: Annotated[
        float | None,
        ApiDescription("When the metric was last seen, as a Unix timestamp. Null when not known"),
    ]
    # Only present when `expand=context` is requested and the
    # data-browsing-attribute-context feature is enabled.
    context: NotRequired[
        Annotated[
            TraceMetricContext,
            ApiDescription("Description of the metric. Only set when expand includes context"),
        ]
    ]
