from __future__ import annotations

from typing import Any, NotRequired, TypedDict

# Ideally this would be fully aligned with sentry_kafka_schemas, but many mutations
# happen in the ingestion pipeline (adding new attributes and removing required
# ones) and it's not clear we want to fully couple those types yet.


class Span(TypedDict):
    span_id: str
    start_timestamp: float
    timestamp: float

    op: NotRequired[str]
    description: NotRequired[str]
    hash: NotRequired[str]
    parent_span_id: NotRequired[str]
    data: NotRequired[dict[str, Any] | None]
    sentry_tags: NotRequired[SentryTags]


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
        "description": NotRequired[str],
        "environment": NotRequired[str],
        "platform": NotRequired[str],
        "release": NotRequired[str],
        "sdk.name": NotRequired[str],
        "system": NotRequired[str],
    },
)
