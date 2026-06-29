"""
Context metadata for Sentry-defined attributes that are *not* part of
``sentry-conventions``.

``sentry-conventions`` describes the semantic telemetry vocabulary (what an
emitted attribute means, largely OTel-aligned). The trace-item search layer also
exposes query-layer aliases and product fields — e.g. ``span.description`` — that
are Sentry-defined (``source_type == sentry``) but aren't semantic conventions,
so they have no entry there.

This module is the home for their context. It mirrors
``sentry_conventions.attributes.ATTRIBUTE_METADATA`` by reusing ``AttributeMetadata``,
so the same context builder works on both. Unlike conventions, attributes here
resolve with ``isConvention=False``; clients distinguish them via ``source_type``.

The keys of each per-item-type map double as the set of attributes the
``/attributes`` endpoint always includes in its response (so they aren't paged
out past the attribute-name limit).
"""

from sentry_conventions.attributes import (
    AttributeMetadata,
    AttributeType,
    IsPii,
    PiiInfo,
    Visibility,
)

from sentry.search.eap.types import SupportedTraceItemType

_NO_PII = PiiInfo(isPii=IsPii.FALSE, reason=None)


def _sentry_attribute(
    brief: str,
    *,
    attribute_type: AttributeType = AttributeType.STRING,
    example: str | None = None,
    additional_context: list[str] | None = None,
) -> AttributeMetadata:
    """Build an ``AttributeMetadata`` for a Sentry-defined (non-convention) attribute."""
    return AttributeMetadata(
        brief=brief,
        type=attribute_type,
        pii=_NO_PII,
        is_in_otel=False,
        visibility=Visibility.PUBLIC,
        example=example,
        additional_context=additional_context,
    )


# Keyed by public alias. Add an entry here to give a Sentry-defined attribute a
# description and guarantee it is returned by the `/attributes` endpoint.
SENTRY_ATTRIBUTE_METADATA: dict[SupportedTraceItemType, dict[str, AttributeMetadata]] = {
    SupportedTraceItemType.SPANS: {
        "span.description": _sentry_attribute(
            "The rendered description of the span, e.g. a SQL query, URL, or "
            "function name. This is the raw, un-normalized description.",
            example="SELECT * FROM users WHERE id = %s",
        ),
    },
    SupportedTraceItemType.LOGS: {},
}
