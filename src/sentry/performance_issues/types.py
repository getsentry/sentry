from __future__ import annotations

from typing import Any, Required, TypedDict

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
    sentry_tags: dict[str, Any]
