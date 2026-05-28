from drf_spectacular.utils import OpenApiExample

from sentry.api.endpoints.organization_trace_meta_types import OrganizationTraceMetaResponse

TRACE_META: OrganizationTraceMetaResponse = {
    "errorsCount": 0,
    "logsCount": 5.0,
    "metricsCount": 0,
    "performanceIssuesCount": 0,
    "spansCount": 195.0,
    "transactionChildCountMap": [
        {"transaction.event_id": "280027d94f30428c83a2de46f932612a", "count()": 7.0},
        {"transaction.event_id": "66087f4e87c847759db67fd62e32829c", "count()": 38.0},
    ],
    "spansCountMap": {
        "db": 58.0,
        "cache.get": 56.0,
        "http.server": 6.0,
    },
}


class TraceExamples:
    TRACE_META = [
        OpenApiExample(
            "Return aggregate metadata for a trace",
            value=TRACE_META,
            response_only=True,
            status_codes=["200"],
        )
    ]
