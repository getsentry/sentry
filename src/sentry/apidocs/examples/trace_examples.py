from drf_spectacular.utils import OpenApiExample

from sentry.api.endpoints.organization_trace_meta_types import OrganizationTraceMetaResponse
from sentry.snuba.trace import SerializedSpan

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


TRACE_SPAN: SerializedSpan = {
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
    "start_timestamp": 1776277351.0,
    "end_timestamp": 1776277351.25,
    "duration": 250.0,
    "measurements": {
        "measurements.frames_slow_rate": 0.02,
        "measurements.frames_frozen_rate": 0.01,
    },
    "browser_web_vital": {
        "browser.web_vital.lcp.value": 2807.335,
        "browser.web_vital.cls.value": 0.0382,
        "browser.web_vital.inp.value": 120.0,
        "browser.web_vital.ttfb.value": 450.0,
        "browser.web_vital.fcp.value": 2258.06,
    },
    "mobile_app_vital": {
        "app.vitals.start.cold.value": 1600.0,
        "app.vitals.start.warm.value": 400.0,
        "app.vitals.ttid.value": 1200.0,
        "app.vitals.ttfd.value": 2400.0,
    },
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
