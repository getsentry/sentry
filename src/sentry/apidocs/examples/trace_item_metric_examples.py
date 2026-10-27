from drf_spectacular.utils import OpenApiExample

from sentry.api.endpoints.organization_trace_item_metrics_types import TraceMetricItem

TRACE_METRICS: list[TraceMetricItem] = [
    {
        "name": "checkout.latency",
        "type": "distribution",
        "unit": "millisecond",
        "count": 1432.0,
        "lastSeen": 1735689600.0,
        "context": {
            "brief": "End-to-end latency of the checkout flow.",
            "details": ["Recorded once per completed checkout, from cart submit to receipt."],
        },
    },
    {
        "name": "cart.items",
        "type": "gauge",
        "unit": None,
        "count": 87.0,
        "lastSeen": 1735686000.0,
    },
]


class TraceItemMetricExamples:
    LIST_TRACE_METRICS = [
        OpenApiExample(
            "List the trace metrics for an organization",
            value=TRACE_METRICS,
            response_only=True,
            status_codes=["200"],
        )
    ]
