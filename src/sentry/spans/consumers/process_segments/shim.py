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

CONTEXT_FIELDS_BY_ATTRIBUTE_NAME: dict[str, dict[str, str]] = {
    "browser": {
        ATTRIBUTE_NAMES.BROWSER_NAME: "name",
        ATTRIBUTE_NAMES.BROWSER_VERSION: "version",
    },
    "os": {
        ATTRIBUTE_NAMES.OS_NAME: "name",
        ATTRIBUTE_NAMES.OS_VERSION: "version",
        ATTRIBUTE_NAMES.OS_ROOTED: "rooted",
    },
    "device": {
        ATTRIBUTE_NAMES.DEVICE_FAMILY: "family",
        ATTRIBUTE_NAMES.DEVICE_MODEL: "model",
        ATTRIBUTE_NAMES.DEVICE_BRAND: "brand",
        ATTRIBUTE_NAMES.DEVICE_NAME: "name",
    },
    "runtime": {
        ATTRIBUTE_NAMES.PROCESS_RUNTIME_NAME: "name",
        ATTRIBUTE_NAMES.PROCESS_RUNTIME_VERSION: "version",
    },
    "profile": {
        ATTRIBUTE_NAMES.SENTRY_PROFILE_ID: "profile_id",
    },
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


def _get_event_tags(segment_span: CompatibleSpan) -> list[list[str]]:
    tags = {"environment": attribute_value(segment_span, ATTRIBUTE_NAMES.SENTRY_ENVIRONMENT)}

    # Our processing pipeline expects tags to be a list of key-value pairs, each one itself
    # formatted as a list (`[[<key1>, <value1>], [<key2>, <value2>], ...]`) rather than a dict.
    return [[key, str(value)] for key, value in tags.items() if value is not None]


def _get_event_contexts(segment_span: CompatibleSpan) -> dict[str, Any]:
    """
    Build the transaction event's `contexts` value from data in the segment span.
    """
    contexts = {}

    # Reconstruct `contexts` entries we're missing
    for context_name, sub_fields_by_attribute_name in CONTEXT_FIELDS_BY_ATTRIBUTE_NAME.items():
        context = _extract_attribute_values(segment_span, sub_fields_by_attribute_name)
        if context:
            contexts[context_name] = {"type": context_name, **context}

    # This is not included in the loop above because its values mostly come directly from the
    # segment span rather than from attributes.
    contexts["trace"] = {
        "trace_id": segment_span["trace_id"],
        "span_id": segment_span["span_id"],
        "op": attribute_value(segment_span, "sentry.transaction.op"),
        "hash": segment_span["hash"],
        "type": "trace",
    }

    return contexts


def _get_detector_compatible_spans(spans: list[CompatibleSpan]) -> list[CompatibleSpan]:
    """
    Return a shallow copy of the given span list, with the fields the legacy issue detectors need
    added to each span.

    Spans in the transaction event protocol carried top-level fields whose segment counterparts live
    in `attributes`. Only the legacy detectors (and the occurrence evidence built from what they
    find) still read the old shape, so this runs solely as part of building the fake transaction
    event, rather than on every span the segment consumer handles.
    """
    event_spans: list[CompatibleSpan] = []

    for span in spans:
        attributes = span.get("attributes") or {}
        # A shallow copy is sufficient here, since detectors don't mutate span data
        event_span: CompatibleSpan = {**span}

        event_span["description"] = attribute_value(span, ATTRIBUTE_NAMES.SENTRY_DESCRIPTION)
        event_span["timestamp"] = span["end_timestamp"]
        event_span["data"] = {}

        for attribute_name in attributes:
            if attribute_name == ATTRIBUTE_NAMES.SENTRY_DESCRIPTION:
                continue  # already set above, at the top level of the span dict

            value = attribute_value(span, attribute_name)
            if value is not None:
                event_span["data"][attribute_name] = value

        event_spans.append(event_span)

    return event_spans


def build_shim_event_data(
    segment_span: CompatibleSpan, spans: list[CompatibleSpan]
) -> dict[str, Any]:
    """Create a shimmed event payload for performance issue detection."""

    event: dict[str, Any] = {
        "type": "transaction",
        "level": "info",
        "event_id": uuid.uuid4().hex,
        "project_id": segment_span["project_id"],
        "received": segment_span["received"],
        "timestamp": segment_span["end_timestamp"],
        "start_timestamp": segment_span["start_timestamp"],
        "datetime": to_datetime(segment_span["end_timestamp"]).strftime("%Y-%m-%dT%H:%M:%SZ"),
        **_extract_attribute_values(segment_span, TOP_LEVEL_FIELDS_BY_ATTRIBUTE_NAME),
    }

    event["contexts"] = _get_event_contexts(segment_span)
    event["tags"] = _get_event_tags(segment_span)
    event["spans"] = _get_detector_compatible_spans(spans)

    return event
