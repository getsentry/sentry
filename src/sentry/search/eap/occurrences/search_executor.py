import logging
from collections.abc import Sequence
from datetime import datetime
from typing import Any

from sentry_protos.snuba.v1.trace_item_filter_pb2 import TraceItemFilter

from sentry.api.event_search import SearchFilter
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.occurrences.attributes import OCCURRENCE_ATTRIBUTE_DEFINITIONS
from sentry.search.eap.occurrences.query_utils import build_group_id_in_filter
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.constants import TAG_KEY_RE
from sentry.search.events.types import SnubaParams
from sentry.snuba.occurrences_rpc import Occurrences
from sentry.utils.cursors import Cursor

logger = logging.getLogger(__name__)


# Filters that must be skipped because they have no EAP equivalent.
# These would silently become dynamic tag lookups in the EAP SearchResolver
# and produce incorrect results.
# TODO: these are potentially gaps between existing issue feed search behavior and EAP search behavior. May need to adddress.
SKIP_FILTERS: frozenset[str] = frozenset(
    {
        # event.type is added internally by _query_params_for_error(), not from user filters.
        # EAP occurrences don't use event.type — they're pre-typed.
        "event.type",
        # Require Postgres Release table lookups (semver matching, stage resolution).
        "release.stage",
        "release.version",
        "release.package",
        "release.build",
        # Virtual alias that expands to coalesce(user.email, user.username, ...).
        # No EAP equivalent.
        "user.display",
        # Requires team context lookup.
        "team_key_transaction",
        # Requires Snuba-specific status code translation.
        "transaction.status",
    }
)

# Filters that need key name translation from legacy Snuba names to EAP attribute names.
# TODO: instead of translating this key, maybe we should just set the public alias for this attribute to "error.main_thread"?
TRANSLATE_KEYS: dict[str, str] = {
    "error.main_thread": "exception_main_thread",
}

# Legacy aggregation field names → EAP aggregate function syntax.
# In the legacy path these become HAVING clauses (e.g. times_seen:>100 → HAVING count() > 100).
# The EAP SearchResolver parses function syntax like count():>100 as AggregateFilter objects
# and routes them to the aggregation_filter field on the RPC request.
AGGREGATION_FIELD_TO_EAP_FUNCTION: dict[str, str] = {
    "last_seen": "last_seen()",
    "times_seen": "count()",
    "first_seen": "first_seen()",
    "user_count": "count_unique(user)",
}

# Upper bound on the grouped count query used when the query contains aggregation
# filters. The legacy path caps similar totals via too_many_candidates handling; the
# UI does not meaningfully distinguish between very large result counts.
EAP_COUNT_QUERY_MAX_LIMIT = 10000

# Sort fields whose legacy aggregations multiply timestamps by 1000 to return
# milliseconds (see executors.py:864-865). EAP's first_seen() / last_seen() are
# plain min/max on `timestamp`, which is stored in seconds. We rescale on both
# sides — cursor values ms → s when filtering, and returned scores s → ms when
# returning — so the caller sees the same units as the legacy path.
MS_SCORE_SORT_FIELDS: frozenset[str] = frozenset({"first_seen", "last_seen"})


def search_filters_to_query_string(
    search_filters: Sequence[SearchFilter],
) -> str:
    """
    Convert Snuba-relevant SearchFilter objects to an EAP query string.

    Expects filters that have already been stripped of postgres-only fields
    (status, assigned_to, bookmarked_by, etc.) by the caller.

    Returns a query string like: 'level:error platform:python message:"foo bar"'
    compatible with the EAP SearchResolver's parse_search_query().
    """
    parts: list[str] = []
    for sf in search_filters:
        part = _convert_single_filter(sf)
        if part is not None:
            parts.append(part)
    return " ".join(parts)


def _convert_single_filter(sf: SearchFilter) -> str | None:
    key = sf.key.name
    op = sf.operator
    raw_value = sf.value.raw_value

    if key in AGGREGATION_FIELD_TO_EAP_FUNCTION:
        return _convert_aggregation_filter(sf)

    if key in SKIP_FILTERS:
        return None

    # error.unhandled requires special inversion logic.
    # Legacy uses notHandled() Snuba function; EAP has error.handled attribute.
    if key == "error.unhandled":
        return _convert_error_unhandled(sf)

    if key in TRANSLATE_KEYS:
        key = TRANSLATE_KEYS[key]

    # User-defined tags (keys not defined as known EAP occurrence attributes)
    # need to be wrapped as `tags[{key}]` so the SearchResolver parses them as
    # tag filters. OCCURRENCE_DEFINITIONS.alias_to_column then maps the tag
    # name to the EAP ingestion format `attr[{key}]` (see item_helpers.py).
    if key not in OCCURRENCE_ATTRIBUTE_DEFINITIONS and not TAG_KEY_RE.match(key):
        key = f"tags[{key}]"

    # has / !has filters: empty string value with = or !=
    if raw_value == "" and op in ("=", "!="):
        if op == "!=":
            return f"has:{key}"
        else:
            return f"!has:{key}"

    formatted_value = _format_value(raw_value)

    if op == "=":
        return f"{key}:{formatted_value}"
    elif op == "!=":
        return f"!{key}:{formatted_value}"
    elif op in (">", ">=", "<", "<="):
        return f"{key}:{op}{formatted_value}"
    elif op == "IN":
        return f"{key}:{formatted_value}"
    elif op == "NOT IN":
        return f"!{key}:{formatted_value}"

    logger.warning(
        "eap.search_executor.unknown_operator",
        extra={"key": key, "operator": op},
    )
    return None


def _convert_aggregation_filter(sf: SearchFilter) -> str | None:
    eap_function = AGGREGATION_FIELD_TO_EAP_FUNCTION[sf.key.name]
    formatted_value = _format_value(sf.value.raw_value)

    if sf.operator in (">", ">=", "<", "<="):
        return f"{eap_function}:{sf.operator}{formatted_value}"
    elif sf.operator == "=":
        return f"{eap_function}:{formatted_value}"
    elif sf.operator == "!=":
        return f"!{eap_function}:{formatted_value}"

    return None


def _convert_error_unhandled(sf: SearchFilter) -> str | None:
    raw_value = sf.value.raw_value
    op = sf.operator

    is_looking_for_unhandled = (op == "=" and raw_value in ("1", 1, True, "true")) or (
        op == "!=" and raw_value in ("0", 0, False, "false")
    )

    if is_looking_for_unhandled:
        return "!error.handled:1"
    else:
        return "error.handled:1"


def _format_value(
    raw_value: str | int | float | datetime | Sequence[str] | Sequence[float],
) -> str:
    if isinstance(raw_value, (list, tuple)):
        parts = ", ".join(_format_single_value(v) for v in raw_value)
        return f"[{parts}]"
    if isinstance(raw_value, datetime):
        return raw_value.isoformat()
    if isinstance(raw_value, bool):
        return "1" if raw_value else "0"
    if isinstance(raw_value, (int, float)):
        return str(raw_value)
    return _format_string_value(str(raw_value))


def _format_single_value(value: str | int | float | datetime) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    return _format_string_value(str(value))


def _format_string_value(s: str) -> str:
    # Quote strings containing spaces or special characters.
    if " " in s or '"' in s or "," in s or "(" in s or ")" in s:
        escaped = s.replace("\\", "\\\\").replace('"', '\\"')
        return f'"{escaped}"'

    return s


# Maps legacy sort_field names (from PostgresSnubaQueryExecutor.sort_strategies values)
# to (selected_columns, orderby) for EAP queries.
#
# Reference — legacy sort_strategies in executors.py:
#   "date" → "last_seen"  → max(timestamp) * 1000
#   "freq" → "times_seen" → count()
#   "new"  → "first_seen" → min(coalesce(group_first_seen, timestamp)) * 1000
#   "user" → "user_count" → uniq(tags[sentry:user])
#   "trends" → "trends"   → complex ClickHouse expression (not supported)
#   "recommended" → "recommended" → complex ClickHouse expression (not supported)
#   "inbox" → ""          → Postgres only (not supported)
#
# group_id is included as a secondary orderby tiebreaker for stable ordering
# within the same score, matching the legacy `[f"-{sort_field}", "group_id"]`.
EAP_SORT_STRATEGIES: dict[str, tuple[list[str], list[str]]] = {
    "last_seen": (["group_id", "last_seen()"], ["-last_seen()", "group_id"]),
    "times_seen": (["group_id", "count()"], ["-count()", "group_id"]),
    "first_seen": (["group_id", "first_seen()"], ["-first_seen()", "group_id"]),
    "user_count": (["group_id", "count_unique(user)"], ["-count_unique(user)", "group_id"]),
}


def run_eap_group_search(
    start: datetime,
    end: datetime,
    project_ids: Sequence[int],
    environment_ids: Sequence[int] | None,
    sort_field: str,
    organization: Organization,
    cursor: Cursor | None = None,
    group_ids: Sequence[int] | None = None,
    limit: int | None = None,
    offset: int = 0,
    search_filters: Sequence[SearchFilter] | None = None,
    referrer: str = "",
) -> tuple[list[tuple[int, Any]], int]:
    """
    EAP equivalent of PostgresSnubaQueryExecutor.snuba_search().

    Returns a tuple of:
        * a list of (group_id, sort_score) tuples,
        * total count (0 during double-reading; legacy provides the real total).
    """
    if sort_field not in EAP_SORT_STRATEGIES:
        return ([], 0)

    selected_columns, orderby = EAP_SORT_STRATEGIES[sort_field]
    score_column = selected_columns[1]  # e.g. "last_seen()" or "count()"

    projects = list(Project.objects.filter(id__in=project_ids, organization_id=organization.id))
    if not projects:
        return ([], 0)

    environments: list[Environment] = []
    if environment_ids:
        environments = list(
            Environment.objects.filter(organization_id=organization.id, id__in=environment_ids)
        )

    snuba_params = SnubaParams(
        start=start,
        end=end,
        organization=organization,
        projects=projects,
        environments=environments,
    )

    query_string = search_filters_to_query_string(search_filters or [])
    query_string = _append_cursor_filter(query_string, cursor, sort_field)

    extra_conditions = None
    if group_ids:
        extra_conditions = build_group_id_in_filter(group_ids)

    try:
        result = Occurrences.run_table_query(
            params=snuba_params,
            query_string=query_string,
            selected_columns=selected_columns,
            orderby=orderby,
            offset=offset,
            limit=limit or 100,
            referrer=referrer,
            config=SearchResolverConfig(),
            extra_conditions=extra_conditions,
        )
    except Exception:
        logger.exception(
            "eap.search_executor.run_table_query_failed",
            extra={
                "organization_id": organization.id,
                "project_ids": project_ids,
                "sort_field": sort_field,
                "referrer": referrer,
            },
        )
        return ([], 0)

    tuples: list[tuple[int, Any]] = []
    for row in result.get("data", []):
        group_id = row.get("group_id")
        score = row.get(score_column)
        if group_id is not None:
            if sort_field in MS_SCORE_SORT_FIELDS and score is not None:
                score = int(score * 1000)
            tuples.append((int(group_id), score))

    # The EAP RPC TraceItemTableResponse does not include a total count
    # (unlike Snuba's totals=True), so we issue a separate aggregate query.
    # When the query contains aggregation filters (HAVING) — either user-supplied
    # or an appended cursor filter — we must use a grouped count query to match
    # the legacy `after_having_exclusive` totals semantics. Otherwise the cheap
    # count_unique(group_id) would treat the aggregation filter as a global
    # condition instead of a per-group one.
    needs_grouped_count = (
        any(sf.key.name in AGGREGATION_FIELD_TO_EAP_FUNCTION for sf in (search_filters or []))
        or cursor is not None
    )
    total = _get_total_count(
        snuba_params=snuba_params,
        query_string=query_string,
        extra_conditions=extra_conditions,
        referrer=referrer,
        organization_id=organization.id,
        needs_grouped_count=needs_grouped_count,
    )

    return (tuples, total)


def _append_cursor_filter(query_string: str, cursor: Cursor | None, sort_field: str) -> str:
    """
    Append an aggregation filter replicating the legacy cursor HAVING clause.

    Legacy behavior (executors.py): having.append((sort_field, ">=" if is_prev else "<=", value))
    EAP equivalent: append {sort_function}:{>=|<=}{cursor.value} to the query string, which
    the SearchResolver parses as an AggregateFilter → routed to the RPC's aggregation_filter.
    """
    if cursor is None:
        return query_string

    sort_function = EAP_SORT_STRATEGIES[sort_field][0][1]  # e.g. "last_seen()" or "count()"
    operator = ">=" if cursor.is_prev else "<="
    cursor_value = cursor.value
    if sort_field in MS_SCORE_SORT_FIELDS:
        cursor_value = float(cursor_value) / 1000
    cursor_filter = f"{sort_function}:{operator}{cursor_value}"
    return f"{query_string} {cursor_filter}".strip()


def _get_total_count(
    *,
    snuba_params: SnubaParams,
    query_string: str,
    extra_conditions: TraceItemFilter | None,
    referrer: str,
    organization_id: int,
    needs_grouped_count: bool,
) -> int:
    """Calculate the total count of matching groups for the given query."""
    try:
        if needs_grouped_count:
            count_result = Occurrences.run_table_query(
                params=snuba_params,
                query_string=query_string,
                selected_columns=["group_id", "count()"],
                orderby=None,
                offset=0,
                limit=EAP_COUNT_QUERY_MAX_LIMIT,
                referrer=referrer,
                config=SearchResolverConfig(),
                extra_conditions=extra_conditions,
            )
            return len(count_result.get("data", []))

        count_result = Occurrences.run_table_query(
            params=snuba_params,
            query_string=query_string,
            selected_columns=["count_unique(group_id)"],
            orderby=None,
            offset=0,
            limit=1,
            referrer=referrer,
            config=SearchResolverConfig(),
            extra_conditions=extra_conditions,
        )
        if count_result["data"]:
            return int(count_result["data"][0].get("count_unique(group_id)", 0))
    except Exception:
        logger.exception(
            "eap.search_executor.count_query_failed",
            extra={"organization_id": organization_id, "referrer": referrer},
        )
    return 0
