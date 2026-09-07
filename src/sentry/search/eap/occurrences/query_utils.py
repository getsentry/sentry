from collections.abc import Callable, Hashable, Mapping, Sequence
from datetime import datetime
from typing import Any

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeKey,
    AttributeValue,
    IntArray,
    StrArray,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry.exceptions import InvalidSearchQuery
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.rpc_utils import and_trace_item_filters, or_trace_item_filters
from sentry.search.events.types import SnubaParams


def _has_odd_backslash_run_before_wildcard(value: str) -> bool:
    """Whether `value` contains a `*` preceded by an odd-length run of backslashes.

    Escaping such a `*` grows the run to an even length, which is exactly what
    `event_search.WILDCARD_CHARS` reads as "escaped backslashes followed by a
    wildcard", so the `*` stays a wildcard no matter how it is written. See
    `_escape_search_query_value`.
    """
    run = 0
    for char in value:
        if char == "\\":
            run += 1
        else:
            if char == "*" and run % 2 == 1:
                return True
            run = 0
    return False


def _escape_search_query_value(field: str, value: str) -> str:
    """Escape `value` so the search grammar resolves it back to `value`, verbatim.

    The grammar (`sentry.api.event_search`) recognizes exactly two escape sequences
    inside a double quoted value: `\\"` yields a literal `"`, and `\\*` yields a
    literal `*` that is not treated as a wildcard. A backslash anywhere else is kept
    as-is, so backslashes must NOT be doubled.
    """
    if value.endswith("\\"):
        # The trailing backslash would escape the term's own closing quote.
        raise InvalidSearchQuery(f"Cannot filter on a {field} value ending in a backslash.")

    if _has_odd_backslash_run_before_wildcard(value):
        raise InvalidSearchQuery(
            f"Cannot filter on a {field} value containing a backslash directly before a `*`."
        )

    return value.replace("*", "\\*").replace('"', '\\"')


def build_escaped_term_filter(field: str, values: Sequence[str]) -> str:
    """Build a search term matching `field` against `values` exactly.

    The term resolves to `OP_EQUALS` for a single value and `OP_IN` for several,
    with each value preserved verbatim -- `*` matches a literal asterisk rather
    than acting as a wildcard.

    Returns an empty string when `values` is empty so callers can concatenate the
    result unconditionally.

    Raises `InvalidSearchQuery` when a value has no exact representation in the
    search grammar, which is the case for values ending in a backslash and for
    values with a backslash directly before a `*`. Both would otherwise resolve to
    a query that silently matches the wrong rows.
    """
    if not values:
        return ""

    escaped_values = [_escape_search_query_value(field, value) for value in values]
    if len(escaped_values) == 1:
        return f'{field}:"{escaped_values[0]}"'

    values_list = ", ".join([f'"{value}"' for value in escaped_values])
    return f"{field}:[{values_list}]"


def build_snuba_params_from_ids(
    organization_id: int,
    project_ids: Sequence[int],
    start: datetime,
    end: datetime,
    environments: Sequence[Environment] | None = None,
    granularity_secs: int | None = None,
) -> SnubaParams | None:
    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        return None

    projects = list(Project.objects.filter(id__in=project_ids, organization_id=organization_id))
    if not projects:
        return None

    return SnubaParams(
        start=start,
        end=end,
        organization=organization,
        projects=projects,
        environments=environments if environments else [],
        granularity_secs=granularity_secs,
    )


def keyed_counts_subset_match(
    control_rows: Sequence[Mapping[str, Any]],
    experimental_rows: Sequence[Mapping[str, Any]],
    key_fn: Callable[[Mapping[str, Any]], Hashable],
    count_field: str = "count()",
) -> bool:
    def _to_count_map(rows: Sequence[Mapping[str, Any]]) -> dict[Hashable, int]:
        output: dict[Hashable, int] = {}
        for row in rows:
            count = row.get(count_field)
            if count is None:
                continue
            key = key_fn(row)
            output[key] = int(count)
        return output

    control_map = _to_count_map(control_rows)
    experimental_map = _to_count_map(experimental_rows)

    if not set(experimental_map).issubset(set(control_map)):
        return False

    return all(exp_count <= control_map[key] for key, exp_count in experimental_map.items())


def build_group_id_in_filter(group_ids: Sequence[int]) -> TraceItemFilter:
    return TraceItemFilter(
        comparison_filter=ComparisonFilter(
            key=AttributeKey(name="group_id", type=AttributeKey.TYPE_INT),
            op=ComparisonFilter.OP_IN,
            value=AttributeValue(val_int_array=IntArray(values=list(group_ids))),
        )
    )


def build_event_id_in_filter(event_ids: Sequence[str]) -> TraceItemFilter:
    return TraceItemFilter(
        comparison_filter=ComparisonFilter(
            key=AttributeKey(name="sentry.item_id", type=AttributeKey.TYPE_STRING),
            op=ComparisonFilter.OP_IN,
            value=AttributeValue(val_str_array=StrArray(values=list(event_ids))),
        )
    )


def build_keyset_pagination_filter(
    timestamp_value: str,
    event_id: str,
) -> TraceItemFilter | None:
    ts_epoch = datetime.fromisoformat(timestamp_value).timestamp()
    timestamp_key = AttributeKey(name="sentry.timestamp", type=AttributeKey.TYPE_DOUBLE)
    event_id_key = AttributeKey(name="sentry.item_id", type=AttributeKey.TYPE_STRING)

    ts_lte = TraceItemFilter(
        comparison_filter=ComparisonFilter(
            key=timestamp_key,
            op=ComparisonFilter.OP_LESS_THAN_OR_EQUALS,
            value=AttributeValue(val_double=ts_epoch),
        )
    )
    ts_lt = TraceItemFilter(
        comparison_filter=ComparisonFilter(
            key=timestamp_key,
            op=ComparisonFilter.OP_LESS_THAN,
            value=AttributeValue(val_double=ts_epoch),
        )
    )
    eid_lt = TraceItemFilter(
        comparison_filter=ComparisonFilter(
            key=event_id_key,
            op=ComparisonFilter.OP_LESS_THAN,
            value=AttributeValue(val_str=event_id),
        )
    )

    return and_trace_item_filters(ts_lte, or_trace_item_filters(ts_lt, eid_lt))
