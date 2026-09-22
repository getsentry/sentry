"""Functions for making span data compatible with the old event processing pipeline.

This is only necessary for logic that is shared between the event processing pipeline and the span processing pipeline,
and thus cannot (yet) be refactored to use the new span schema.
"""

import uuid
from typing import Any

from sentry_conventions.attributes import ATTRIBUTE_NAMES
from sentry_kafka_schemas.schema_types.ingest_spans_v1 import SpanEvent

from sentry.spans.consumers.process_segments.types import (
    CompatibleSpan,
    attribute_value,
    get_span_op,
)
from sentry.utils.dates import to_datetime

EMPTY_ATTRIBUTE_VALUES = frozenset({"", None})

TOP_LEVEL_FIELDS_BY_ATTRIBUTE_NAME = {
    ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME: "transaction",
    ATTRIBUTE_NAMES.SENTRY_RELEASE: "release",
    ATTRIBUTE_NAMES.SENTRY_DIST: "dist",
    ATTRIBUTE_NAMES.SENTRY_ENVIRONMENT: "environment",
    ATTRIBUTE_NAMES.SENTRY_PLATFORM: "platform",
}

SPAN_SENTRY_TAGS_FIELDS_BY_ATTRIBUTE_NAME = {
    ATTRIBUTE_NAMES.SENTRY_NORMALIZED_DESCRIPTION: "description",
    ATTRIBUTE_NAMES.SENTRY_ENVIRONMENT: "environment",
    ATTRIBUTE_NAMES.SENTRY_PLATFORM: "platform",
    ATTRIBUTE_NAMES.SENTRY_RELEASE: "release",
    ATTRIBUTE_NAMES.SENTRY_SDK_NAME: "sdk.name",
    "sentry.system": "system",
}


def make_compatible(span: SpanEvent) -> CompatibleSpan:
    # Creates attributes for EAP spans that are required by logic shared with the
    # event pipeline.
    #
    # Spans in the transaction event protocol had a different schema
    # compared to raw spans on the EAP topic. This function adds the missing
    # attributes to the spans to make them compatible with the event pipeline
    # logic.
    sentry_tags = _extract_attribute_values(span, SPAN_SENTRY_TAGS_FIELDS_BY_ATTRIBUTE_NAME)

    ret: CompatibleSpan = {
        **span,
        "sentry_tags": {key: str(value) for key, value in sentry_tags.items()},
        "op": get_span_op(span),
        "exclusive_time": attribute_value(span, "sentry.exclusive_time_ms"),
    }

    return ret


def _extract_attribute_values(
    segment_span: CompatibleSpan | SpanEvent, attribute_to_field_map: dict[str, str]
) -> dict[str, Any]:
    """
    Pull data from the segment span's attributes for every field in the given map.

    Returns a dict of all non-null, non-empty values found, keyed by event field name.
    """
    values_by_field_name = {}

    for attribute_name, field_name in attribute_to_field_map.items():
        value = attribute_value(segment_span, attribute_name)
        if value not in EMPTY_ATTRIBUTE_VALUES:
            values_by_field_name[field_name] = value

    return values_by_field_name


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
        "tags": [
            ["environment", attribute_value(segment_span, ATTRIBUTE_NAMES.SENTRY_ENVIRONMENT)]
        ],
        "received": segment_span["received"],
        "timestamp": segment_span["end_timestamp"],
        "start_timestamp": segment_span["start_timestamp"],
        "datetime": to_datetime(segment_span["end_timestamp"]).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "spans": [],
        **_extract_attribute_values(segment_span, TOP_LEVEL_FIELDS_BY_ATTRIBUTE_NAME),
    }

    if (profile_id := attribute_value(segment_span, ATTRIBUTE_NAMES.SENTRY_PROFILE_ID)) is not None:
        event["contexts"]["profile"] = {"profile_id": profile_id, "type": "profile"}

    # Add legacy span attributes required only by issue detectors. As opposed to
    # real event payloads, this also adds the segment span so detectors can run
    # topological sorting on the span tree.
    #
    # TODO: Remove this code once `organizations:performance-issues-spans` has graduated
    # and performance issue detection runs 100% on spans.
    for span in spans:
        # A shallow copy is sufficient here, since detectors don't mutate span data
        event_span = {**span}
        event_span["timestamp"] = span["end_timestamp"]
        event_span["data"] = {}
        for key, value in (span.get("attributes") or {}).items():
            if (value := attribute_value(event_span, key)) is not None:
                if key == ATTRIBUTE_NAMES.SENTRY_DESCRIPTION:
                    event_span["description"] = value
                else:
                    event_span["data"][key] = value

        event["spans"].append(event_span)

    return event
