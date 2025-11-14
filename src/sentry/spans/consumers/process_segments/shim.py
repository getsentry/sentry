"""Functions for making span data compatible with the old event processing pipeline.

This is only necessary for logic that is shared between the event processing pipeline and the span processing pipeline,
and thus cannot (yet) be refactored to use the new span schema.
"""

import uuid
from copy import deepcopy
from typing import Any, cast, int

import sentry_sdk
from sentry_kafka_schemas.schema_types.ingest_spans_v1 import SpanEvent

from sentry.issue_detection.types import SentryTags as PerformanceIssuesSentryTags
from sentry.spans.consumers.process_segments.types import (
    CompatibleSpan,
    attribute_value,
    get_span_op,
)
from sentry.utils.dates import to_datetime


def make_compatible(span: SpanEvent) -> CompatibleSpan:
    # Creates attributes for EAP spans that are required by logic shared with the
    # event pipeline.
    #
    # Spans in the transaction event protocol had a different schema
    # compared to raw spans on the EAP topic. This function adds the missing
    # attributes to the spans to make them compatible with the event pipeline
    # logic.
    ret: CompatibleSpan = {
        **span,
        "sentry_tags": _sentry_tags(span.get("attributes") or {}),
        "op": get_span_op(span),
        "exclusive_time": attribute_value(span, "sentry.exclusive_time_ms"),
    }

    return ret


def _sentry_tags(attributes: dict[str, Any]) -> dict[str, str]:
    """Backfill sentry tags used in performance issue detection.

    Once performance issue detection is only called from process_segments,
    (not from event_manager), the performance issues code can be refactored to access
    span attributes instead of sentry_tags.
    """
    sentry_tags = {}
    for tag_key in PerformanceIssuesSentryTags.__mutable_keys__:
        attribute_key = (
            "sentry.normalized_description" if tag_key == "description" else f"sentry.{tag_key}"
        )
        if attribute_key in attributes:
            try:
                sentry_tags[tag_key] = str((attributes[attribute_key] or {}).get("value"))
            except Exception:
                sentry_sdk.capture_exception()

    return sentry_tags


def build_shim_event_data(
    segment_span: CompatibleSpan, spans: list[CompatibleSpan]
) -> dict[str, Any]:
    """Create a shimmed event payload for performance issue detection."""

    event: dict[str, Any] = {
        "type": "transaction",
        "level": "info",
        "contexts": {
            "trace": {
                "trace_id": segment_span["trace_id"],
                "type": "trace",
                "op": attribute_value(segment_span, "sentry.transaction.op"),
                "span_id": segment_span["span_id"],
                "hash": segment_span["hash"],
            },
        },
        "event_id": uuid.uuid4().hex,
        "project_id": segment_span["project_id"],
        "transaction": attribute_value(segment_span, "sentry.transaction"),
        "release": attribute_value(segment_span, "sentry.release"),
        "dist": attribute_value(segment_span, "sentry.dist"),
        "environment": attribute_value(segment_span, "sentry.environment"),
        "platform": attribute_value(segment_span, "sentry.platform"),
        "tags": [["environment", attribute_value(segment_span, "sentry.environment")]],
        "received": segment_span["received"],
        "timestamp": segment_span["end_timestamp"],
        "start_timestamp": segment_span["start_timestamp"],
        "datetime": to_datetime(segment_span["end_timestamp"]).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "spans": [],
    }

    if (profile_id := attribute_value(segment_span, "sentry.profile_id")) is not None:
        event["contexts"]["profile"] = {"profile_id": profile_id, "type": "profile"}

    # Add legacy span attributes required only by issue detectors. As opposed to
    # real event payloads, this also adds the segment span so detectors can run
    # topological sorting on the span tree.
    for span in spans:
        event_span = cast(dict[str, Any], deepcopy(span))
        event_span["start_timestamp"] = span["start_timestamp"]
        event_span["timestamp"] = span["end_timestamp"]
        event["spans"].append(event_span)

    return event
