"""Functions for making span data compatible with the old event processing pipeline.

This is only necessary for logic that is shared between the event processing pipeline and the span processing pipeline,
and thus cannot (yet) be refactored to use the new span schema.
"""

import uuid
from copy import deepcopy
from typing import Any, cast

from sentry_kafka_schemas.schema_types.buffered_segments_v1 import _SentryExtractedTags

from sentry.issue_detection.types import SentryTags as PerformanceIssuesSentryTags
from sentry.spans.consumers.process_segments.types import CompatibleSpan, EnrichedSpan, get_span_op
from sentry.utils.dates import to_datetime


def make_compatible(span: EnrichedSpan) -> CompatibleSpan:
    # Creates attributes for EAP spans that are required by logic shared with the
    # event pipeline.
    #
    # Spans in the transaction event protocol had a slightly different schema
    # compared to raw spans on the EAP topic. This function adds the missing
    # attributes to the spans to make them compatible with the event pipeline
    # logic.
    ret: CompatibleSpan = {
        **span,
        "sentry_tags": _sentry_tags(span.get("data") or {}),
        "op": get_span_op(span),
        # Note: Event protocol spans expect `exclusive_time` while EAP expects
        # `exclusive_time_ms`. Both are the same value in milliseconds
        "exclusive_time": span["exclusive_time_ms"],
    }

    return ret


def _sentry_tags(data: dict[str, Any]) -> _SentryExtractedTags:
    """Backfill sentry tags used in performance issue detection.

    Once performance issue detection is only called from process_segments,
    (not from event_manager), the performance issues code can be refactored to access
    span attributes instead of sentry_tags.
    """
    sentry_tags: _SentryExtractedTags = {}
    for tag_key in PerformanceIssuesSentryTags.__mutable_keys__:
        data_key = (
            "sentry.normalized_description" if tag_key == "description" else f"sentry.{tag_key}"
        )
        if data_key in data:
            sentry_tags[tag_key] = data[data_key]  # type: ignore[literal-required]

    return sentry_tags


def build_shim_event_data(
    segment_span: CompatibleSpan, spans: list[CompatibleSpan]
) -> dict[str, Any]:
    """Create a shimmed event payload for performance issue detection."""
    data = segment_span.get("data", {})

    event: dict[str, Any] = {
        "type": "transaction",
        "level": "info",
        "contexts": {
            "trace": {
                "trace_id": segment_span["trace_id"],
                "type": "trace",
                "op": data.get("sentry.transaction.op"),
                "span_id": segment_span["span_id"],
                "hash": segment_span["hash"],
            },
        },
        "event_id": uuid.uuid4().hex,
        "project_id": segment_span["project_id"],
        "transaction": data.get("sentry.transaction"),
        "release": data.get("sentry.release"),
        "dist": data.get("sentry.dist"),
        "environment": data.get("sentry.environment"),
        "platform": data.get("sentry.platform"),
        "tags": [["environment", data.get("sentry.environment")]],
        "received": segment_span["received"],
        "timestamp": segment_span["end_timestamp_precise"],
        "start_timestamp": segment_span["start_timestamp_precise"],
        "datetime": to_datetime(segment_span["end_timestamp_precise"]).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        ),
        "spans": [],
    }

    if (profile_id := segment_span.get("profile_id")) is not None:
        event["contexts"]["profile"] = {"profile_id": profile_id, "type": "profile"}

    # Add legacy span attributes required only by issue detectors. As opposed to
    # real event payloads, this also adds the segment span so detectors can run
    # topological sorting on the span tree.
    for span in spans:
        event_span = cast(dict[str, Any], deepcopy(span))
        event_span["start_timestamp"] = span["start_timestamp_precise"]
        event_span["timestamp"] = span["end_timestamp_precise"]
        event["spans"].append(event_span)

    return event
