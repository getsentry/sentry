"""Query use-case module.

For now, this is the search and sort entry-point.  Some of this code may be moved to
replays/query.py when the pre-existing query module is deprecated.

There are two important functions in this module: "search_filter_to_condition" and
"query_using_optimized_search".  "search_filter_to_condition" is responsible for transforming a
SearchFilter into a Condition.  This is the only entry-point into the Field system.

"query_using_optimized_search" is the request processing engine.  It accepts raw data from an
external source, makes decisions around what to query and when, and is responsible for returning
intelligible output for the "post_process" module.  More information on its implementation can be
found in the function.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime, timedelta
from typing import Any, Literal, cast

import sentry_sdk
from rest_framework.exceptions import ParseError
from snuba_sdk import (
    And,
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Granularity,
    Op,
    Or,
    OrderBy,
    Query,
    Request,
)
from snuba_sdk.expressions import Expression

from sentry.api.event_search import ParenExpression, SearchFilter, SearchKey, SearchValue
from sentry.models.organization import Organization
from sentry.replays.lib.new_query.errors import CouldNotParseValue, OperatorNotSupported
from sentry.replays.lib.new_query.fields import ColumnField, ExpressionField, FieldProtocol
from sentry.replays.usecases.query.errors import RetryAggregated
from sentry.replays.usecases.query.fields import ComputedField, TagField
from sentry.utils.snuba import RateLimitExceeded, raw_snql_query

VIEWED_BY_ME_KEY_ALIASES = ["viewed_by_me", "seen_by_me"]
NULL_VIEWED_BY_ID_VALUE = 0  # default value in clickhouse
DEFAULT_SORT_FIELD = "started_at"

PREFERRED_SOURCE = Literal["aggregated", "scalar"]


def handle_viewed_by_me_filters(
    search_filters: Sequence[SearchFilter | str | ParenExpression], request_user_id: int | None
) -> Sequence[SearchFilter | str | ParenExpression]:
    """Translate "viewed_by_me" as it's not a valid Snuba field, but a convenience alias for the frontend"""
    new_filters = []
    for search_filter in search_filters:
        if (
            not isinstance(search_filter, SearchFilter)
            or search_filter.key.name not in VIEWED_BY_ME_KEY_ALIASES
        ):
            new_filters.append(search_filter)
            continue

        # since the value is boolean, negations (!) are not supported
        if search_filter.operator != "=":
            raise ParseError(f"Invalid operator specified for `{search_filter.key.name}`")

        value = search_filter.value.value
        if not isinstance(value, str) or value.lower() not in ["true", "false"]:
            raise ParseError(
                f"Could not parse value '{search_filter.value.value}' for `{search_filter.key.name}`"
            )
        value = value.lower() == "true"

        if request_user_id is None:
            # This case will only occur from programmer error.
            # Note the replay index endpoint returns 401 automatically for unauthorized and anonymous users.
            raise ValueError("Invalid user id")

        operator = "=" if value else "!="
        new_filters.append(
            SearchFilter(
                SearchKey("viewed_by_id"),
                operator,
                SearchValue(request_user_id),
            )
        )

    return new_filters


def handle_search_filters(
    search_config: dict[str, FieldProtocol],
    search_filters: Sequence[SearchFilter | str | ParenExpression],
) -> list[Condition]:
    """Convert search filters to snuba conditions."""
    result: list[Condition] = []
    look_back = None
    for search_filter in search_filters:
        # SearchFilters are transformed into Conditions and appended to the result set.  If they
        # are top level filters they are implicitly AND'ed in the WHERE/HAVING clause.  Otherwise
        # explicit operators are used.
        if isinstance(search_filter, SearchFilter):

            try:
                condition = search_filter_to_condition(search_config, search_filter)
                if condition is None:
                    raise ParseError(f"Unsupported search field: {search_filter.key.name}")
            except OperatorNotSupported:
                raise ParseError(f"Invalid operator specified for `{search_filter.key.name}`")
            except CouldNotParseValue as e:
                err_msg = f"Could not parse value '{search_filter.value.value}' for `{search_filter.key.name}`."
                if e.args:
                    err_msg += (
                        f" {e.args[0]}"  # avoid using str(e) as it may expose stack trace info
                    )
                raise ParseError(err_msg)

            if look_back == "AND":
                look_back = None
                attempt_compressed_condition(result, condition, And)
            elif look_back == "OR":
                look_back = None
                attempt_compressed_condition(result, condition, Or)
            else:
                result.append(condition)
        # ParenExpressions are recursively computed.  If more than one condition is returned then
        # those conditions are AND'ed.
        elif isinstance(search_filter, ParenExpression):
            conditions = handle_search_filters(search_config, search_filter.children)
            if len(conditions) < 2:
                result.extend(conditions)
            else:
                result.append(And(conditions))
        # String types are limited to AND and OR... I think?  In the case where its not a valid
        # look-back it is implicitly ignored.
        elif isinstance(search_filter, str):
            look_back = search_filter

    return result


def attempt_compressed_condition(
    result: list[Expression],
    condition: Condition,
    condition_type: And | Or,
):
    """Unnecessary query optimization.

    Improves legibility for query debugging. Clickhouse would flatten these nested OR statements
    internally anyway.

    (block OR block) OR block => (block OR block OR block)
    """
    if isinstance(result[-1], condition_type):
        result[-1].conditions.append(condition)
    else:
        result.append(condition_type([result.pop(), condition]))


def search_filter_to_condition(
    search_config: dict[str, FieldProtocol],
    search_filter: SearchFilter,
) -> Condition | None:
    field = search_config.get(search_filter.key.name)
    if isinstance(field, (ColumnField, ExpressionField, ComputedField)):
        return field.apply(search_filter)

    if "*" in search_config:
        field = cast(TagField, search_config["*"])
        return field.apply(search_filter)

    return None


# Everything below here will move to replays/query.py once we deprecate the old query behavior.
# Leaving it here for now so this is easier to review/remove.
import dataclasses

from sentry.replays.usecases.query.configs.aggregate import search_config as agg_search_config
from sentry.replays.usecases.query.configs.aggregate_sort import sort_config as agg_sort_config
from sentry.replays.usecases.query.configs.aggregate_sort import sort_is_scalar_compatible
from sentry.replays.usecases.query.configs.scalar import (
    can_scalar_search_subquery,
    scalar_search_config,
)


@dataclasses.dataclass
class Paginators:
    limit: int
    offset: int


@dataclasses.dataclass
class QueryResponse:
    response: list[Any]
    has_more: bool
    source: str


def query_using_optimized_search(
    fields: list[str],
    search_filters: Sequence[SearchFilter | str | ParenExpression],
    environments: list[str],
    sort: str | None,
    pagination: Paginators,
    organization: Organization | None,
    project_ids: list[int],
    period_start: datetime,
    period_stop: datetime,
    request_user_id: int | None = None,
    preferred_source: PREFERRED_SOURCE = "scalar",
):
    tenant_id = _make_tenant_id(organization)

    # Environments is provided to us outside of the ?query= url parameter. It's stil filtered like
    # the values in that parameter so let's shove it inside and process it like any other filter.
    if environments:
        search_filters = [
            *search_filters,
            SearchFilter(SearchKey("environment"), "IN", SearchValue(environments)),
        ]

    # Translate "viewed_by_me" filters, which are aliases for "viewed_by_id"
    search_filters = handle_viewed_by_me_filters(search_filters, request_user_id)

    if preferred_source == "aggregated":
        query, referrer, source = _query_using_aggregated_strategy(
            search_filters,
            sort,
            project_ids,
            period_start,
            period_stop,
        )
    else:
        query, referrer, source = _query_using_scalar_strategy(
            search_filters,
            sort,
            project_ids,
            period_start,
            period_stop,
        )

    query = query.set_limit(pagination.limit)
    query = query.set_offset(pagination.offset)

    subquery_response = execute_query(query, tenant_id, referrer)

    # The query "has more rows" if the number of rows found matches the limit (which is
    # the requested limit + 1).
    has_more = len(subquery_response.get("data", [])) == pagination.limit
    if has_more:
        subquery_response["data"].pop()

    # These replay_ids are ordered by the OrderBy expression in the query above.
    replay_ids = [row["replay_id"] for row in subquery_response.get("data", [])]
    if not replay_ids:
        return QueryResponse(
            response=[],
            has_more=has_more,
            source=source,
        )

    # The final aggregation step.  Here we pass the replay_ids as the only filter.  In this step
    # we select everything and use as much memory as we need to complete the operation.
    #
    # If this step runs out of memory your pagination size is about 1,000,000 rows too large.
    # That's a joke.  This will complete very quickly at normal pagination sizes.
    results = execute_query(
        make_full_aggregation_query(
            fields=fields,
            replay_ids=replay_ids,
            project_ids=project_ids,
            period_start=period_start,
            period_end=period_stop,
            request_user_id=request_user_id,
        ),
        tenant_id,
        referrer="replays.query.browse_query",
    )["data"]

    return QueryResponse(
        response=_make_ordered(replay_ids, results),
        has_more=has_more,
        source=source,
    )


def _query_using_scalar_strategy(
    search_filters: Sequence[SearchFilter | str | ParenExpression],
    sort: str | None,
    project_ids: list[int],
    period_start: datetime,
    period_stop: datetime,
):
    can_scalar_search = can_scalar_search_subquery(search_filters, period_start)
    can_scalar_sort = sort_is_scalar_compatible(sort or DEFAULT_SORT_FIELD)
    if not can_scalar_search or not can_scalar_sort:
        return _query_using_aggregated_strategy(
            search_filters,
            sort,
            project_ids,
            period_start,
            period_stop,
        )

    # NOTE: This query may return replay-ids which do not have a segment_id 0 row. These replays
    # will be removed from the final output and could lead to pagination peculiarities. In
    # practice, this is not expected to be noticable by the end-user.
    #
    # To fix this issue remove the ability to search against "varying" columns and apply a
    # "segment_id = 0" condition to the WHERE clause.

    try:
        where = handle_search_filters(scalar_search_config, search_filters)
        orderby = handle_ordering(agg_sort_config, sort or "-" + DEFAULT_SORT_FIELD)
    except RetryAggregated:
        return _query_using_aggregated_strategy(
            search_filters,
            sort,
            project_ids,
            period_start,
            period_stop,
        )

    query = Query(
        match=Entity("replays"),
        select=[Column("replay_id")],
        where=[
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("timestamp"), Op.LT, period_stop),
            Condition(Column("timestamp"), Op.GTE, period_start),
            *where,
        ],
        orderby=orderby,
        groupby=[Column("replay_id")],
        granularity=Granularity(3600),
    )

    return (query, "replays.query.browse_scalar_conditions_subquery", "scalar-subquery")


def _query_using_aggregated_strategy(
    search_filters: Sequence[SearchFilter | str | ParenExpression],
    sort: str | None,
    project_ids: list[int],
    period_start: datetime,
    period_stop: datetime,
):
    orderby = handle_ordering(agg_sort_config, sort or "-" + DEFAULT_SORT_FIELD)

    having: list[Condition] = handle_search_filters(agg_search_config, search_filters)
    having.append(Condition(Function("min", parameters=[Column("segment_id")]), Op.EQ, 0))

    query = Query(
        match=Entity("replays"),
        select=[Column("replay_id")],
        where=[
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("timestamp"), Op.LT, period_stop),
            Condition(Column("timestamp"), Op.GTE, period_start),
        ],
        having=having,
        orderby=orderby,
        groupby=[Column("replay_id")],
        granularity=Granularity(3600),
    )

    return (query, "replays.query.browse_aggregated_conditions_subquery", "aggregated-subquery")


def make_full_aggregation_query(
    fields: list[str],
    replay_ids: list[str],
    project_ids: list[int],
    period_start: datetime,
    period_end: datetime,
    request_user_id: int | None,
) -> Query:
    """Return a query to fetch every replay in the set.

    Arguments:
        fields -- if non-empty, used to query a subset of fields. Corresponds to the keys in QUERY_ALIAS_COLUMN_MAP.
    """
    from sentry.replays.query import QUERY_ALIAS_COLUMN_MAP, compute_has_viewed, select_from_fields

    def _select_from_fields() -> list[Column | Function]:
        if fields:
            return select_from_fields(list(set(fields)), user_id=request_user_id)
        else:
            return list(QUERY_ALIAS_COLUMN_MAP.values()) + [compute_has_viewed(request_user_id)]

    return Query(
        match=Entity("replays"),
        select=_select_from_fields(),
        where=[
            Condition(Column("project_id"), Op.IN, project_ids),
            # Replay-ids were pre-calculated so no having clause and no aggregating significant
            # amounts of data.
            Condition(Column("replay_id"), Op.IN, replay_ids),
            # We can scan an extended time range to account for replays which span either end of
            # the range.  These timestamps are an optimization and could be removed with minimal
            # performance impact.  It's a point query.  Its super fast.
            Condition(Column("timestamp"), Op.GTE, period_start - timedelta(hours=1)),
            Condition(Column("timestamp"), Op.LT, period_end + timedelta(hours=1)),
        ],
        # NOTE: Refer to this note: "make_scalar_search_conditions_query".
        #
        # This condition ensures that every replay shown to the user is valid.
        having=[Condition(Function("min", parameters=[Column("segment_id")]), Op.EQ, 0)],
        groupby=[Column("replay_id")],
        granularity=Granularity(3600),
    )


def execute_query(query: Query, tenant_id: dict[str, int], referrer: str) -> Mapping[str, Any]:
    try:
        return raw_snql_query(
            Request(
                dataset="replays",
                app_id="replay-backend-web",
                query=query,
                tenant_ids=tenant_id,
            ),
            referrer,
        )
    except RateLimitExceeded as exc:
        sentry_sdk.set_tag("replay-rate-limit-exceeded", True)
        sentry_sdk.set_tag("org_id", tenant_id.get("organization_id"))
        sentry_sdk.set_extra("referrer", referrer)
        sentry_sdk.capture_exception(exc)
        raise


def handle_ordering(config: dict[str, Expression], sort: str) -> list[OrderBy]:
    if sort.startswith("-"):
        return [OrderBy(_get_sort_column(config, sort[1:]), Direction.DESC)]
    else:
        return [OrderBy(_get_sort_column(config, sort), Direction.ASC)]


def _get_sort_column(config: dict[str, Expression], column_name: str) -> Function:
    try:
        return config[column_name]
    except KeyError:
        raise ParseError(f"The field `{column_name}` is not a sortable field.")


def _make_tenant_id(organization: Organization | None) -> dict[str, int]:
    if organization is None:
        return {}
    else:
        return {"organization_id": organization.id}


def _make_ordered(replay_ids: list[str], results: Any) -> list[Any]:
    if not replay_ids:
        return []
    elif not results:
        return []

    replay_id_to_index = {}
    i = 0
    for replay_id in replay_ids:
        if replay_id not in replay_id_to_index:
            replay_id_to_index[replay_id] = i
            i += 1

    ordered_results = [None] * len(replay_id_to_index)
    for result in results:
        index = replay_id_to_index[result["replay_id"]]
        ordered_results[index] = result

    return list(filter(None, ordered_results))
