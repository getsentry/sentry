from drf_spectacular.utils import OpenApiExample

from sentry.api.endpoints.organization_trace_item_stats_types import TraceItemStatsResponse

TRACE_ITEM_STATS: TraceItemStatsResponse = {
    "data": [
        {
            "attributeDistributions": {
                "data": {
                    "sentry.device": [
                        {"label": "mobile", "value": 3.0},
                        {"label": "desktop", "value": 1.0},
                    ],
                    "browser.name": [
                        {"label": "chrome", "value": 3.0},
                        {"label": "safari", "value": 1.0},
                    ],
                }
            }
        }
    ]
}


class TraceItemStatsExamples:
    TRACE_ITEM_STATS = [
        OpenApiExample(
            "Attribute distributions for the matching trace items",
            value=TRACE_ITEM_STATS,
            response_only=True,
            status_codes=["200"],
        )
    ]
