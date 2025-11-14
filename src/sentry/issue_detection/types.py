from __future__ import annotations

from typing import Any, Required, TypedDict, int

# Ideally this would be fully aligned with sentry_kafka_schemas, but many mutations
# happen in the ingestion pipeline (adding new attributes and removing required
# ones) and it's not clear we want to fully couple those types yet.


class Span(TypedDict, total=False):
    span_id: Required[str]
    start_timestamp: Required[float]
    timestamp: Required[float]

    op: str
    description: str
    hash: str
    parent_span_id: str
    data: dict[str, Any] | None
    sentry_tags: SentryTags


#: Sentry tags used in performance issue detection.
#:
#: This definition is used to shim sentry_tags for spans in process_segments.
#:
#: Once performance issue detection is only called from process_segments,
#: (not from event_manager), the performance issues code can be refactored to access
#: span attributes instead of sentry_tags.
SentryTags = TypedDict(
    "SentryTags",
    {
        "description": str,
        "environment": str,
        "platform": str,
        "release": str,
        "sdk.name": str,
        "system": str,
    },
    total=False,
)
