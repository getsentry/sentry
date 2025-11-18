from datetime import datetime
from typing import Literal

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.endpoint_time_series_pb2 import TimeSeriesRequest

from sentry.search.eap.columns import ColumnDefinitions, ResolvedAttribute
from sentry.search.eap.constants import SENTRY_INTERNAL_PREFIXES
from sentry.search.eap.ourlogs.attributes import (
    LOGS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
    LOGS_INTERNAL_TO_SECONDARY_ALIASES_MAPPING,
    LOGS_PRIVATE_ATTRIBUTE_PREFIXES,
    LOGS_PRIVATE_ATTRIBUTES,
    LOGS_REPLACEMENT_ATTRIBUTES,
    LOGS_REPLACEMENT_MAP,
    OURLOG_ATTRIBUTE_DEFINITIONS,
)
from sentry.search.eap.ourlogs.definitions import OURLOG_DEFINITIONS
from sentry.search.eap.profile_functions.attributes import (
    PROFILE_FUNCTIONS_ATTRIBUTE_DEFINITIONS,
    PROFILE_FUNCTIONS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
    PROFILE_FUNCTIONS_INTERNAL_TO_SECONDARY_ALIASES_MAPPING,
    PROFILE_FUNCTIONS_PRIVATE_ATTRIBUTE_PREFIXES,
    PROFILE_FUNCTIONS_PRIVATE_ATTRIBUTES,
    PROFILE_FUNCTIONS_REPLACEMENT_ATTRIBUTES,
    PROFILE_FUNCTIONS_REPLACEMENT_MAP,
)
from sentry.search.eap.profile_functions.definitions import PROFILE_FUNCTIONS_DEFINITIONS
from sentry.search.eap.spans.attributes import (
    SPAN_ATTRIBUTE_DEFINITIONS,
    SPAN_INTERNAL_TO_SECONDARY_ALIASES_MAPPING,
    SPANS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
    SPANS_PRIVATE_ATTRIBUTE_PREFIXES,
    SPANS_PRIVATE_ATTRIBUTES,
    SPANS_REPLACEMENT_ATTRIBUTES,
    SPANS_REPLACEMENT_MAP,
)
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.trace_metrics.attributes import (
    TRACE_METRICS_ATTRIBUTE_DEFINITIONS,
    TRACE_METRICS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
    TRACE_METRICS_INTERNAL_TO_SECONDARY_ALIASES_MAPPING,
    TRACE_METRICS_PRIVATE_ATTRIBUTE_PREFIXES,
    TRACE_METRICS_PRIVATE_ATTRIBUTES,
    TRACE_METRICS_REPLACEMENT_ATTRIBUTES,
    TRACE_METRICS_REPLACEMENT_MAP,
)
from sentry.search.eap.trace_metrics.definitions import TRACE_METRICS_DEFINITIONS
from sentry.search.eap.types import AttributeSource, AttributeSourceType, SupportedTraceItemType


def add_start_end_conditions(
    in_msg: TimeSeriesRequest, start: datetime, end: datetime
) -> TimeSeriesRequest:
    start_time_proto = Timestamp()
    start_time_proto.FromDatetime(start)
    end_time_proto = Timestamp()
    end_time_proto.FromDatetime(end)
    in_msg.meta.start_timestamp.CopyFrom(start_time_proto)
    in_msg.meta.end_timestamp.CopyFrom(end_time_proto)

    return in_msg


INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS: dict[
    SupportedTraceItemType, dict[Literal["string", "number"], dict[str, str]]
] = {
    SupportedTraceItemType.SPANS: SPANS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
    SupportedTraceItemType.LOGS: LOGS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
    SupportedTraceItemType.TRACEMETRICS: TRACE_METRICS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
    SupportedTraceItemType.PROFILE_FUNCTIONS: PROFILE_FUNCTIONS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
}

PUBLIC_ALIAS_TO_INTERNAL_MAPPING: dict[SupportedTraceItemType, dict[str, ResolvedAttribute]] = {
    SupportedTraceItemType.SPANS: SPAN_ATTRIBUTE_DEFINITIONS,
    SupportedTraceItemType.LOGS: OURLOG_ATTRIBUTE_DEFINITIONS,
    SupportedTraceItemType.TRACEMETRICS: TRACE_METRICS_ATTRIBUTE_DEFINITIONS,
    SupportedTraceItemType.PROFILE_FUNCTIONS: PROFILE_FUNCTIONS_ATTRIBUTE_DEFINITIONS,
}


PRIVATE_ATTRIBUTES: dict[SupportedTraceItemType, set[str]] = {
    SupportedTraceItemType.SPANS: SPANS_PRIVATE_ATTRIBUTES,
    SupportedTraceItemType.LOGS: LOGS_PRIVATE_ATTRIBUTES,
    SupportedTraceItemType.TRACEMETRICS: TRACE_METRICS_PRIVATE_ATTRIBUTES,
    SupportedTraceItemType.PROFILE_FUNCTIONS: PROFILE_FUNCTIONS_PRIVATE_ATTRIBUTES,
}

PRIVATE_ATTRIBUTE_PREFIXES: dict[SupportedTraceItemType, set[str]] = {
    SupportedTraceItemType.SPANS: SPANS_PRIVATE_ATTRIBUTE_PREFIXES,
    SupportedTraceItemType.LOGS: LOGS_PRIVATE_ATTRIBUTE_PREFIXES,
    SupportedTraceItemType.TRACEMETRICS: TRACE_METRICS_PRIVATE_ATTRIBUTE_PREFIXES,
    SupportedTraceItemType.PROFILE_FUNCTIONS: PROFILE_FUNCTIONS_PRIVATE_ATTRIBUTE_PREFIXES,
}

SENTRY_CONVENTIONS_REPLACEMENT_ATTRIBUTES: dict[SupportedTraceItemType, set[str]] = {
    SupportedTraceItemType.SPANS: SPANS_REPLACEMENT_ATTRIBUTES,
    SupportedTraceItemType.LOGS: LOGS_REPLACEMENT_ATTRIBUTES,
    SupportedTraceItemType.TRACEMETRICS: TRACE_METRICS_REPLACEMENT_ATTRIBUTES,
    SupportedTraceItemType.PROFILE_FUNCTIONS: PROFILE_FUNCTIONS_REPLACEMENT_ATTRIBUTES,
}

SENTRY_CONVENTIONS_REPLACEMENT_MAPPINGS: dict[SupportedTraceItemType, dict[str, str]] = {
    SupportedTraceItemType.SPANS: SPANS_REPLACEMENT_MAP,
    SupportedTraceItemType.LOGS: LOGS_REPLACEMENT_MAP,
    SupportedTraceItemType.TRACEMETRICS: TRACE_METRICS_REPLACEMENT_MAP,
    SupportedTraceItemType.PROFILE_FUNCTIONS: PROFILE_FUNCTIONS_REPLACEMENT_MAP,
}


INTERNAL_TO_SECONDARY_ALIASES: dict[SupportedTraceItemType, dict[str, set[str]]] = {
    SupportedTraceItemType.SPANS: SPAN_INTERNAL_TO_SECONDARY_ALIASES_MAPPING,
    SupportedTraceItemType.LOGS: LOGS_INTERNAL_TO_SECONDARY_ALIASES_MAPPING,
    SupportedTraceItemType.TRACEMETRICS: TRACE_METRICS_INTERNAL_TO_SECONDARY_ALIASES_MAPPING,
    SupportedTraceItemType.PROFILE_FUNCTIONS: PROFILE_FUNCTIONS_INTERNAL_TO_SECONDARY_ALIASES_MAPPING,
}

TRACE_ITEM_TYPE_DEFINITIONS: dict[SupportedTraceItemType, ColumnDefinitions] = {
    SupportedTraceItemType.SPANS: SPAN_DEFINITIONS,
    SupportedTraceItemType.LOGS: OURLOG_DEFINITIONS,
    SupportedTraceItemType.TRACEMETRICS: TRACE_METRICS_DEFINITIONS,
    SupportedTraceItemType.PROFILE_FUNCTIONS: PROFILE_FUNCTIONS_DEFINITIONS,
}


def translate_internal_to_public_alias(
    internal_alias: str,
    type: Literal["string", "number"],
    item_type: SupportedTraceItemType,
) -> tuple[str | None, str | None, AttributeSource]:
    mapping = INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS.get(item_type, {}).get(type, {})
    public_alias = mapping.get(internal_alias)
    if public_alias is not None:
        return public_alias, public_alias, {"source_type": AttributeSourceType.SENTRY}

    resolved_column = PUBLIC_ALIAS_TO_INTERNAL_MAPPING.get(item_type, {}).get(internal_alias)
    if resolved_column is not None:
        # if there is a known public alias with this exact name, it means we need to wrap
        # it in the explicitly typed tags syntax in order for it to reference the correct column
        return (
            f"tags[{internal_alias},{type}]",
            internal_alias,
            {"source_type": AttributeSourceType.SENTRY},
        )

    definitions = TRACE_ITEM_TYPE_DEFINITIONS.get(item_type)
    if definitions is not None:
        if definitions.column_to_alias is not None:
            column = definitions.column_to_alias(internal_alias)
            if column is not None:
                if type == "string":
                    return (
                        column,
                        column,
                        {
                            "source_type": AttributeSourceType.SENTRY,
                            "is_transformed_alias": True,
                        },
                    )
                return (
                    f"tags[{column},{type}]",
                    column,
                    {
                        "source_type": AttributeSourceType.SENTRY,
                        "is_transformed_alias": True,
                    },
                )

    return None, None, {"source_type": AttributeSourceType.USER}


def get_secondary_aliases(
    internal_alias: str, item_type: SupportedTraceItemType
) -> set[str] | None:
    mapping = INTERNAL_TO_SECONDARY_ALIASES.get(item_type, {})
    return mapping.get(internal_alias)


def can_expose_attribute(
    attribute: str, item_type: SupportedTraceItemType, include_internal: bool = False
) -> bool:
    # Always omit private attributes
    if attribute in PRIVATE_ATTRIBUTES.get(item_type, {}) or any(
        attribute.lower().startswith(prefix.lower())
        for prefix in PRIVATE_ATTRIBUTE_PREFIXES.get(item_type, {})
    ):
        return False

    # Omit internal attributes, unless explicitly requested. Usually, only
    # Sentry staff should see these.
    if any(attribute.lower().startswith(prefix.lower()) for prefix in SENTRY_INTERNAL_PREFIXES):
        return include_internal

    return True


def is_sentry_convention_replacement_attribute(
    public_alias: str, item_type: SupportedTraceItemType
) -> bool:
    return public_alias in SENTRY_CONVENTIONS_REPLACEMENT_ATTRIBUTES.get(item_type, {})


def translate_to_sentry_conventions(public_alias: str, item_type: SupportedTraceItemType) -> str:
    mapping = SENTRY_CONVENTIONS_REPLACEMENT_MAPPINGS.get(item_type, {})
    return mapping.get(public_alias, public_alias)
