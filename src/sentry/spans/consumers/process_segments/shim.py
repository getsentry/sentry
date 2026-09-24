"""Functions for making span data compatible with the old event processing pipeline.

This is only necessary for logic that is shared between the event processing pipeline and the span processing pipeline,
and thus cannot (yet) be refactored to use the new span schema.
"""

import uuid
from typing import Any
from urllib.parse import parse_qsl

from sentry_conventions.attributes import ATTRIBUTE_NAMES
from sentry_kafka_schemas.schema_types.ingest_spans_v1 import SpanEvent

from sentry.spans.consumers.process_segments.types import (
    Attribute,
    CompatibleSpan,
    attribute_value,
    get_span_op,
)
from sentry.utils import json
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

USER_FIELDS_BY_ATTRIBUTE_NAME = {
    ATTRIBUTE_NAMES.USER_ID: "id",
    ATTRIBUTE_NAMES.USER_EMAIL: "email",
    ATTRIBUTE_NAMES.USER_NAME: "username",
    ATTRIBUTE_NAMES.USER_IP_ADDRESS: "ip_address",
}
GEO_FIELDS_BY_ATTRIBUTE_NAME = {
    ATTRIBUTE_NAMES.USER_GEO_CITY: "city",
    ATTRIBUTE_NAMES.USER_GEO_COUNTRY_CODE: "country_code",
    ATTRIBUTE_NAMES.USER_GEO_REGION: "region",
    ATTRIBUTE_NAMES.USER_GEO_SUBDIVISION: "subdivision",
}

SDK_FIELDS_BY_ATTRIBUTE_NAME = {
    ATTRIBUTE_NAMES.SENTRY_SDK_NAME: "name",
    ATTRIBUTE_NAMES.SENTRY_SDK_VERSION: "version",
}

# There are multiple entries per field here, because which one of these attributes we get is
# SDK-dependent. They're listed in reverse priority order, with successively-higher-priority
# attribuates overwriting lower-priority ones if they have a value.
REQUEST_FIELDS_BY_ATTRIBUTE_NAME = {
    ATTRIBUTE_NAMES.URL_TEMPLATE: "url",
    ATTRIBUTE_NAMES.HTTP_ROUTE: "url",
    ATTRIBUTE_NAMES.URL_PATH: "url",
    ATTRIBUTE_NAMES.URL_FULL: "url",
    "sentry.transaction.method": "method",
    ATTRIBUTE_NAMES.HTTP_REQUEST_METHOD: "method",
    ATTRIBUTE_NAMES.URL_QUERY: "query_string",
    ATTRIBUTE_NAMES.HTTP_REQUEST_BODY_DATA: "data",
}

SPAN_SENTRY_TAGS_FIELDS_BY_ATTRIBUTE_NAME = {
    ATTRIBUTE_NAMES.SENTRY_NORMALIZED_DESCRIPTION: "description",
    ATTRIBUTE_NAMES.SENTRY_ENVIRONMENT: "environment",
    ATTRIBUTE_NAMES.SENTRY_PLATFORM: "platform",
    ATTRIBUTE_NAMES.SENTRY_RELEASE: "release",
    ATTRIBUTE_NAMES.SENTRY_SDK_NAME: "sdk.name",
    "sentry.system": "system",
}

KNOWN_NON_TAG_ATTRIBUTE_PREFIXES = frozenset({"sentry.", "user.", "browser.web_vital."})
KNOWN_NON_TAG_ATTRIBUTES = frozenset().union(
    TOP_LEVEL_FIELDS_BY_ATTRIBUTE_NAME.keys(),
    USER_FIELDS_BY_ATTRIBUTE_NAME.keys(),
    GEO_FIELDS_BY_ATTRIBUTE_NAME.keys(),
    SDK_FIELDS_BY_ATTRIBUTE_NAME.keys(),
    REQUEST_FIELDS_BY_ATTRIBUTE_NAME.keys(),
    SPAN_SENTRY_TAGS_FIELDS_BY_ATTRIBUTE_NAME.keys(),
    *(inner_dict.keys() for inner_dict in CONTEXT_FIELDS_BY_ATTRIBUTE_NAME.values()),
)


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


def _is_tag_like_attribute(key: str, attribute: Attribute) -> bool:
    """
    Decide whether a segment span attribute should be included in the event's `tags` value.
    """
    # Insurance - in practice attributes should never be malformed in this way
    if "value" not in attribute:
        return False  # type: ignore[unreachable]

    # Tags are always strings, so anything that's not doesn't belong in `tags`. This is also an easy
    # way to exclude measurement attributes, since they always come through as floats.
    if attribute.get("type") != "string":
        return False

    # Attributes we recognize as ones whose data will end up elsewhere in the event
    if key in KNOWN_NON_TAG_ATTRIBUTES or any(
        key.startswith(prefix) for prefix in KNOWN_NON_TAG_ATTRIBUTE_PREFIXES
    ):
        return False

    # Everything else is kept as a tag
    return True


def _get_event_tags(segment_span: CompatibleSpan) -> list[list[str]]:
    """
    Build the transaction event's `tags` value from data in the segment span.
    """
    attributes = segment_span.get("attributes") or {}
    tags = {
        key: attribute.get("value")
        for key, attribute in attributes.items()
        if attribute and _is_tag_like_attribute(key, attribute)
    }

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


def _get_event_user(segment_span: CompatibleSpan) -> dict[str, Any] | None:
    """
    Rebuild the event's `user` entry from the `user.*` attributes on the segment span.
    """
    user_data = _extract_attribute_values(segment_span, USER_FIELDS_BY_ATTRIBUTE_NAME)
    geo_data = _extract_attribute_values(segment_span, GEO_FIELDS_BY_ATTRIBUTE_NAME)

    if not user_data and not geo_data:
        return None

    if geo_data:
        user_data["geo"] = geo_data

    return user_data


def _get_event_request(segment_span: CompatibleSpan) -> dict[str, Any]:
    request_data = _extract_attribute_values(segment_span, REQUEST_FIELDS_BY_ATTRIBUTE_NAME)

    if "query_string" in request_data:
        # Convert from a single string to a list of key-value pairs
        request_data["query_string"] = parse_qsl(request_data["query_string"])

    if "data" in request_data:
        try:
            request_data["data"] = json.loads(request_data["data"])
        except Exception:
            pass

        # If the JSON failed to parse, or if it parsed successfully but is the wrong shape (arrays
        # are legal request bodies, though not ones our detectors can handle), drop the data to
        # avoid storing information we can't use.
        if not isinstance(request_data["data"], dict):
            del request_data["data"]

    return request_data


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

    user_data = _get_event_user(segment_span)
    if user_data:
        event["user"] = user_data

    sdk_data = _extract_attribute_values(segment_span, SDK_FIELDS_BY_ATTRIBUTE_NAME)
    if sdk_data:
        event["sdk"] = sdk_data

    request_data = _get_event_request(segment_span)
    if request_data:
        event["request"] = request_data

    return event
