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


TRACE_SPAN = {
    "event_id": "0123456789abcdef0123456789abcdef",
    "event_type": "span",
    "transaction_id": "280027d94f30428c83a2de46f932612a",
    "project_id": 4505281256090153,
    "project_slug": "javascript",
    "transaction": "POST /api/0/projects/{org}/{proj}/events/{event_id}/attachments/",
    "description": "POST /api/0/projects/{org}/{proj}/events/{event_id}/attachments/",
    "op": "http.server",
    "name": "http.server",
    "parent_span_id": None,
    "profile_id": "",
    "profiler_id": "",
    "sdk_name": "sentry.python",
    "is_transaction": True,
    "start_timestamp": "2026-04-15T18:22:31.000000Z",
    "end_timestamp": "2026-04-15T18:22:31.250000Z",
    "duration": 250.0,
    "measurements": {},
    "children": [],
    "errors": [],
    "occurrences": [],
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
    TRACE = [
        OpenApiExample(
            "Return the spans, errors, and occurrences of a trace",
            value=[TRACE_SPAN],
            response_only=True,
            status_codes=["200"],
        )
    ]
