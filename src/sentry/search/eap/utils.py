from collections.abc import Collection, Mapping
from datetime import datetime
from typing import Literal

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_conventions.attributes import ATTRIBUTE_METADATA as ATTRIBUTE_METADATA
from sentry_protos.snuba.v1.endpoint_time_series_pb2 import TimeSeriesRequest
from sentry_protos.snuba.v1.endpoint_trace_item_attributes_pb2 import TraceItemAttributeNamesRequest
from sentry_protos.snuba.v1.request_common_pb2 import PageToken, RequestMeta
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ExistsFilter, OrFilter, TraceItemFilter

from sentry.search.eap.columns import ColumnDefinitions, ResolvedAttribute
from sentry.search.eap.constants import (
    ARRAY,
    BOOLEAN,
    SENTRY_INTERNAL_PREFIXES,
    STRING,
    TYPE_MAP,
    SearchType,
)
from sentry.search.eap.occurrences.attributes import (
    OCCURRENCE_ATTRIBUTE_DEFINITIONS,
    OCCURRENCE_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
    OCCURRENCE_INTERNAL_TO_SECONDARY_ALIASES_MAPPING,
    OCCURRENCE_PRIVATE_ATTRIBUTE_PREFIXES,
    OCCURRENCE_PRIVATE_ATTRIBUTES,
    OCCURRENCE_REPLACEMENT_ATTRIBUTES,
    OCCURRENCE_REPLACEMENT_MAP,
)
from sentry.search.eap.occurrences.definitions import OCCURRENCE_DEFINITIONS
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
from sentry.search.eap.preprod_size.attributes import (
    PREPROD_SIZE_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
)
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
from sentry.search.eap.types import (
    AttributeSource,
    AttributeSourceType,
    ColumnType,
    SupportedTraceItemType,
)
from sentry.utils import snuba_rpc
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor


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
    SupportedTraceItemType, dict[Literal["string", "number", "boolean"], dict[str, str]]
] = {
    SupportedTraceItemType.SPANS: SPANS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
    SupportedTraceItemType.LOGS: LOGS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
    SupportedTraceItemType.TRACEMETRICS: TRACE_METRICS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
    SupportedTraceItemType.PROFILE_FUNCTIONS: PROFILE_FUNCTIONS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
    SupportedTraceItemType.PREPROD: PREPROD_SIZE_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
    SupportedTraceItemType.OCCURRENCES: OCCURRENCE_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
}

PUBLIC_ALIAS_TO_INTERNAL_MAPPING: dict[SupportedTraceItemType, dict[str, ResolvedAttribute]] = {
    SupportedTraceItemType.SPANS: SPAN_ATTRIBUTE_DEFINITIONS,
    SupportedTraceItemType.LOGS: OURLOG_ATTRIBUTE_DEFINITIONS,
    SupportedTraceItemType.TRACEMETRICS: TRACE_METRICS_ATTRIBUTE_DEFINITIONS,
    SupportedTraceItemType.PROFILE_FUNCTIONS: PROFILE_FUNCTIONS_ATTRIBUTE_DEFINITIONS,
    SupportedTraceItemType.OCCURRENCES: OCCURRENCE_ATTRIBUTE_DEFINITIONS,
}


PRIVATE_ATTRIBUTES: dict[SupportedTraceItemType, set[str]] = {
    SupportedTraceItemType.SPANS: SPANS_PRIVATE_ATTRIBUTES,
    SupportedTraceItemType.LOGS: LOGS_PRIVATE_ATTRIBUTES,
    SupportedTraceItemType.TRACEMETRICS: TRACE_METRICS_PRIVATE_ATTRIBUTES,
    SupportedTraceItemType.PROFILE_FUNCTIONS: PROFILE_FUNCTIONS_PRIVATE_ATTRIBUTES,
    SupportedTraceItemType.OCCURRENCES: OCCURRENCE_PRIVATE_ATTRIBUTES,
}

PRIVATE_ATTRIBUTE_PREFIXES: dict[SupportedTraceItemType, set[str]] = {
    SupportedTraceItemType.SPANS: SPANS_PRIVATE_ATTRIBUTE_PREFIXES,
    SupportedTraceItemType.LOGS: LOGS_PRIVATE_ATTRIBUTE_PREFIXES,
    SupportedTraceItemType.TRACEMETRICS: TRACE_METRICS_PRIVATE_ATTRIBUTE_PREFIXES,
    SupportedTraceItemType.PROFILE_FUNCTIONS: PROFILE_FUNCTIONS_PRIVATE_ATTRIBUTE_PREFIXES,
    SupportedTraceItemType.OCCURRENCES: OCCURRENCE_PRIVATE_ATTRIBUTE_PREFIXES,
}

SENTRY_CONVENTIONS_REPLACEMENT_ATTRIBUTES: dict[SupportedTraceItemType, set[str]] = {
    SupportedTraceItemType.SPANS: SPANS_REPLACEMENT_ATTRIBUTES,
    SupportedTraceItemType.LOGS: LOGS_REPLACEMENT_ATTRIBUTES,
    SupportedTraceItemType.TRACEMETRICS: TRACE_METRICS_REPLACEMENT_ATTRIBUTES,
    SupportedTraceItemType.PROFILE_FUNCTIONS: PROFILE_FUNCTIONS_REPLACEMENT_ATTRIBUTES,
    SupportedTraceItemType.OCCURRENCES: OCCURRENCE_REPLACEMENT_ATTRIBUTES,
}

SENTRY_CONVENTIONS_REPLACEMENT_MAPPINGS: dict[SupportedTraceItemType, dict[str, str]] = {
    SupportedTraceItemType.SPANS: SPANS_REPLACEMENT_MAP,
    SupportedTraceItemType.LOGS: LOGS_REPLACEMENT_MAP,
    SupportedTraceItemType.TRACEMETRICS: TRACE_METRICS_REPLACEMENT_MAP,
    SupportedTraceItemType.PROFILE_FUNCTIONS: PROFILE_FUNCTIONS_REPLACEMENT_MAP,
    SupportedTraceItemType.OCCURRENCES: OCCURRENCE_REPLACEMENT_MAP,
}


SENTRY_CONVENTIONS_REVERSE_REPLACEMENT_MAP: dict[SupportedTraceItemType, dict[str, set[str]]] = {}
for _item_type, _replacement_map in SENTRY_CONVENTIONS_REPLACEMENT_MAPPINGS.items():
    _internal_mapping = PUBLIC_ALIAS_TO_INTERNAL_MAPPING.get(_item_type, {})
    _reverse: dict[str, set[str]] = {}
    for _deprecated_alias, _replacement in _replacement_map.items():
        _resolved = _internal_mapping.get(_deprecated_alias)
        _internal_name = _resolved.internal_name if _resolved else _deprecated_alias
        _reverse.setdefault(_replacement, set()).add(_internal_name)
    SENTRY_CONVENTIONS_REVERSE_REPLACEMENT_MAP[_item_type] = _reverse


INTERNAL_TO_SECONDARY_ALIASES: dict[SupportedTraceItemType, dict[str, set[str]]] = {
    SupportedTraceItemType.SPANS: SPAN_INTERNAL_TO_SECONDARY_ALIASES_MAPPING,
    SupportedTraceItemType.LOGS: LOGS_INTERNAL_TO_SECONDARY_ALIASES_MAPPING,
    SupportedTraceItemType.TRACEMETRICS: TRACE_METRICS_INTERNAL_TO_SECONDARY_ALIASES_MAPPING,
    SupportedTraceItemType.PROFILE_FUNCTIONS: PROFILE_FUNCTIONS_INTERNAL_TO_SECONDARY_ALIASES_MAPPING,
    SupportedTraceItemType.OCCURRENCES: OCCURRENCE_INTERNAL_TO_SECONDARY_ALIASES_MAPPING,
}

TRACE_ITEM_TYPE_DEFINITIONS: dict[SupportedTraceItemType, ColumnDefinitions] = {
    SupportedTraceItemType.SPANS: SPAN_DEFINITIONS,
    SupportedTraceItemType.LOGS: OURLOG_DEFINITIONS,
    SupportedTraceItemType.TRACEMETRICS: TRACE_METRICS_DEFINITIONS,
    SupportedTraceItemType.PROFILE_FUNCTIONS: PROFILE_FUNCTIONS_DEFINITIONS,
    SupportedTraceItemType.OCCURRENCES: OCCURRENCE_DEFINITIONS,
}


def serialize_search_type(search_type: SearchType) -> str:
    proto_type = TYPE_MAP.get(search_type)
    if proto_type == STRING:
        return "string"
    if proto_type == BOOLEAN:
        return "boolean"
    if proto_type == ARRAY:
        return "array"
    # DOUBLE, INT, or anything else numeric
    return "number"


def translate_search_type_for_internal_column(
    internal_name: str,
    item_type: SupportedTraceItemType,
) -> Literal["string", "number", "boolean"] | None:
    for search_type, mapping in INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS.get(item_type, {}).items():
        if internal_name in mapping:
            return search_type
    return None


def translate_internal_to_public_alias(
    internal_alias: str,
    search_type: ColumnType,
    item_type: SupportedTraceItemType,
) -> tuple[str | None, str | None, AttributeSource]:
    if search_type != "array":
        mapping = INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS.get(item_type, {}).get(search_type, {})
        public_alias = mapping.get(internal_alias)
        if public_alias is not None:
            return public_alias, public_alias, {"source_type": AttributeSourceType.SENTRY}

    resolved_column = PUBLIC_ALIAS_TO_INTERNAL_MAPPING.get(item_type, {}).get(internal_alias)
    if resolved_column is not None:
        # A data attribute whose name collides with a known public alias is a
        # user-sent attribute; it's wrapped in the explicitly typed tags syntax so
        # it references the user's column rather than the reserved alias. It is
        # user-sourced, not Sentry-defined (e.g. a customer's own `organization.id`).
        return (
            f"tags[{internal_alias},{search_type}]",
            internal_alias,
            {"source_type": AttributeSourceType.USER},
        )

    definitions = TRACE_ITEM_TYPE_DEFINITIONS.get(item_type)
    if definitions is not None:
        if definitions.column_to_alias is not None:
            column = definitions.column_to_alias(internal_alias)
            if column is not None:
                if search_type == "string":
                    return (
                        column,
                        column,
                        {
                            "source_type": AttributeSourceType.SENTRY,
                            "is_transformed_alias": True,
                        },
                    )
                return (
                    f"tags[{column},{search_type}]",
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


def _has_internal_convention_visibility(attribute: str) -> bool:
    metadata = ATTRIBUTE_METADATA.get(attribute)
    if metadata is None:
        return False

    visibility = metadata.visibility
    return getattr(visibility, "value", visibility) == "internal"


def _get_sentry_convention_visibility_candidates(
    attribute: str, item_type: SupportedTraceItemType
) -> set[str]:
    candidates = {attribute}

    if attribute.startswith(("dsc.", "_internal.")):
        candidates.add(f"sentry.{attribute}")

    resolved_attribute = PUBLIC_ALIAS_TO_INTERNAL_MAPPING.get(item_type, {}).get(attribute)
    if resolved_attribute is not None:
        candidates.add(resolved_attribute.public_alias)
        candidates.add(resolved_attribute.internal_name)
        if resolved_attribute.replacement:
            candidates.add(resolved_attribute.replacement)

    for mapping in INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS.get(item_type, {}).values():
        public_alias = mapping.get(attribute)
        if public_alias is not None:
            candidates.add(public_alias)

    replacement_map = SENTRY_CONVENTIONS_REPLACEMENT_MAPPINGS.get(item_type, {})
    pending = list(candidates)
    while pending:
        candidate = pending.pop()
        replacement = replacement_map.get(candidate)
        if replacement is not None and replacement not in candidates:
            candidates.add(replacement)
            pending.append(replacement)

    return candidates


def is_internal_sentry_convention_attribute(
    attribute: str, item_type: SupportedTraceItemType
) -> bool:
    return any(
        _has_internal_convention_visibility(candidate)
        for candidate in _get_sentry_convention_visibility_candidates(attribute, item_type)
    )


def can_expose_attribute_to_api(
    attribute: str, item_type: SupportedTraceItemType, include_internal: bool = False
) -> bool:
    """Return whether an attribute may be exposed by public API surfaces.

    The visibility check expands the requested attribute to its related public
    aliases, internal names, and replacement attributes because any of those may
    carry the metadata that marks the underlying convention as internal.
    `include_internal` only allows those Sentry-owned internal convention
    attributes. It does not bypass `can_expose_attribute`, which still filters
    private attributes first.
    """
    candidates = _get_sentry_convention_visibility_candidates(attribute, item_type)

    for candidate in candidates:
        if not can_expose_attribute(candidate, item_type, include_internal=include_internal):
            return False

    # Private attributes are rejected above before this internal-only override
    # is applied.
    if include_internal:
        return True

    return not any(
        is_internal_sentry_convention_attribute(candidate, item_type) for candidate in candidates
    )


def is_sentry_convention_replacement_attribute(
    public_alias: str, item_type: SupportedTraceItemType
) -> bool:
    return public_alias in SENTRY_CONVENTIONS_REPLACEMENT_ATTRIBUTES.get(item_type, {})


def get_deprecated_source_internal_names(
    replacement: str, item_type: SupportedTraceItemType
) -> set[str]:
    return SENTRY_CONVENTIONS_REVERSE_REPLACEMENT_MAP.get(item_type, {}).get(replacement, set())


# We want to limit the number of threads to avoid overwhelming the RPC server.
MAX_ATTRIBUTE_VALIDATION_THREADS = 3
ATTRIBUTE_NAME_LIMIT = 10_000
# Past this many pages we give up and report the name as missing rather than keep
# spending RPCs on an org whose attributes dwarf the limit.
MAX_ATTRIBUTE_NAME_PAGES = 3


def _attribute_names_request(
    meta: RequestMeta,
    attr_type: AttributeKey.Type.ValueType,
    names: Collection[str],
    value_substring_match: str = "",
    offset: int = 0,
) -> TraceItemAttributeNamesRequest:
    # TODO(wmak): Need to update snuba here so we can pass the list of attributes, snuba currently does a hasAll if we
    # pass names in a OrFilter which means only rows with _all_ attributes will return
    return TraceItemAttributeNamesRequest(
        meta=meta,
        limit=ATTRIBUTE_NAME_LIMIT,
        page_token=PageToken(offset=offset),
        type=attr_type,
        value_substring_match=value_substring_match,
        match_mode=TraceItemAttributeNamesRequest.MatchMode.MATCH_MODE_ANY,
        # Selects which items snuba scans, not which names come back from them: every
        # attribute co-occurring on a matching item is returned, so a wide filter can
        # collect far more names than were asked about
        intersecting_attributes_filter=TraceItemFilter(
            or_filter=OrFilter(
                filters=[
                    TraceItemFilter(
                        exists_filter=ExistsFilter(key=AttributeKey(type=attr_type, name=name))
                    )
                    for name in names
                ]
            )
        ),
    )


def attribute_name_exists(
    meta: RequestMeta,
    attr_type: AttributeKey.Type.ValueType,
    name: str,
) -> bool:
    """Check a single typed attribute name, matching on the name to narrow what we page through."""
    for page in range(MAX_ATTRIBUTE_NAME_PAGES):
        response = snuba_rpc.attribute_names_rpc(
            _attribute_names_request(
                meta,
                attr_type,
                [name],
                value_substring_match=name,
                offset=page * ATTRIBUTE_NAME_LIMIT,
            )
        )
        if any(attribute.name == name for attribute in response.attributes):
            return True
        # The substring match still returns every name containing this one, so a
        # short enough name can page itself out
        if len(response.attributes) < ATTRIBUTE_NAME_LIMIT:
            break

    return False


def _attribute_names_page(
    meta: RequestMeta,
    attr_type: AttributeKey.Type.ValueType,
    names: Collection[str],
    offset: int = 0,
) -> tuple[set[str], bool]:
    """One page of typed names matching the filter, and whether more pages remain."""
    requested_names = set(names)
    response = snuba_rpc.attribute_names_rpc(
        _attribute_names_request(meta, attr_type, requested_names, offset=offset)
    )
    found = {
        attribute.name for attribute in response.attributes if attribute.name in requested_names
    }
    return found, len(response.attributes) >= ATTRIBUTE_NAME_LIMIT


def _check_attribute_names_by_type(
    meta: RequestMeta,
    attr_type: AttributeKey.Type.ValueType,
    names: Collection[str],
) -> set[str]:
    """Check which of the typed names exist in storage for the meta's window."""
    if not names:
        return set()

    requested_names = set(names)
    found, more = _attribute_names_page(meta, attr_type, requested_names)
    if found == requested_names or not more:
        return found

    # Refiltering on just the missing names shrinks the set of items snuba scans, and
    # so the co-occurring names it collects, often back under the limit
    filter_names = requested_names - found
    if filter_names != requested_names:
        retry_found, more = _attribute_names_page(meta, attr_type, filter_names)
        found |= retry_found
        if found == requested_names or not more:
            return found

    for page in range(1, MAX_ATTRIBUTE_NAME_PAGES):
        page_found, more = _attribute_names_page(
            meta, attr_type, filter_names, offset=page * ATTRIBUTE_NAME_LIMIT
        )
        found |= page_found
        if found == requested_names or not more:
            break

    return found


def check_attribute_names_exist(
    meta: RequestMeta,
    names_by_type: Mapping[AttributeKey.Type.ValueType, Collection[str]],
) -> set[tuple[AttributeKey.Type.ValueType, str]]:
    """Check which typed attribute names exist in storage for the meta's window."""
    if not names_by_type:
        return set()

    found: set[tuple[AttributeKey.Type.ValueType, str]] = set()
    with ContextPropagatingThreadPoolExecutor(
        thread_name_prefix="attr_validate",
        max_workers=MAX_ATTRIBUTE_VALIDATION_THREADS,
    ) as pool:
        futures = {
            attr_type: pool.submit(_check_attribute_names_by_type, meta, attr_type, names)
            for attr_type, names in names_by_type.items()
        }
        for attr_type, future in futures.items():
            found.update((attr_type, name) for name in future.result())

    return found
