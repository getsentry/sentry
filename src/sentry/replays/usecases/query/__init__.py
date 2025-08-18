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
from datetime import datetime
from typing import Any, Literal, cast

import sentry_sdk
from rest_framework.exceptions import ParseError
from snuba_sdk import And, Column, Condition, Direction, Function, Op, Or, OrderBy, Query, Request
from snuba_sdk.expressions import Expression

from sentry import options
from sentry.api.event_search import (
    ParenExpression,
    QueryToken,
    SearchFilter,
    SearchKey,
    SearchValue,
)
from sentry.api.exceptions import BadRequest
from sentry.models.organization import Organization
from sentry.replays.lib.new_query.errors import CouldNotParseValue, OperatorNotSupported
from sentry.replays.lib.new_query.fields import ColumnField, ExpressionField, FieldProtocol
from sentry.replays.usecases.query.errors import RetryAggregated
from sentry.replays.usecases.query.fields import ComputedField, TagField
from sentry.replays.usecases.replay import get_replay_ids, get_replays
from sentry.utils.snuba import RateLimitExceeded, raw_snql_query

VIEWED_BY_ME_KEY_ALIASES = ["viewed_by_me", "seen_by_me"]
VIEWED_BY_KEYS = ["viewed_by_me", "seen_by_me", "viewed_by_id", "seen_by_id"]
NULL_VIEWED_BY_ID_VALUE = 0  # default value in clickhouse
DEFAULT_SORT_FIELD = "started_at"

VIEWED_BY_DENYLIST_MSG = (
    "Viewed by search has been disabled for your project due to a data irregularity."
)

PREFERRED_SOURCE = Literal["aggregated", "scalar"]


def handle_viewed_by_me_filters(
    search_filters: Sequence[QueryToken], request_user_id: int | None
) -> Sequence[QueryToken]:
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
            raise ParseError(f"Could not parse value for `{search_filter.key.name}`")
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
    search_filters: Sequence[QueryToken],
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
                err_msg = f"Could not parse value for `{search_filter.key.name}`."
                if e.args and e.args[0]:
                    # avoid using str(e) as it may expose stack trace info
                    err_msg += f" Detail: {e.args[0]}"
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


def _has_viewed_by_filter(search_filter: QueryToken) -> bool:
    if isinstance(search_filter, SearchFilter):
        return search_filter.key.name in VIEWED_BY_KEYS
    if isinstance(search_filter, ParenExpression):
        return any([_has_viewed_by_filter(child) for child in search_filter.children])

    return False  # isinstance(search_filter, str) - not parseable


def query_using_optimized_search(
    fields: list[str],
    search_filters: Sequence[QueryToken],
    environments: list[str],
    sort: str | None,
    pagination: Paginators,
    organization_id: int,
    project_ids: list[int],
    period_start: datetime,
    period_stop: datetime,
    request_user_id: int | None = None,
    preferred_source: PREFERRED_SOURCE = "scalar",
):
    # Environments is provided to us outside of the ?query= url parameter. It's stil filtered like
    # the values in that parameter so let's shove it inside and process it like any other filter.
    if environments:
        search_filters = [
            *search_filters,
            SearchFilter(SearchKey("environment"), "IN", SearchValue(environments)),
        ]

    viewed_by_denylist = options.get("replay.viewed-by.project-denylist")
    if any([project_id in viewed_by_denylist for project_id in project_ids]):
        # Skip all viewed by filters if in denylist
        for search_filter in search_filters:
            if _has_viewed_by_filter(search_filter):
                raise BadRequest(message=VIEWED_BY_DENYLIST_MSG)
    else:
        # Translate "viewed_by_me" filters, which are aliases for "viewed_by_id"
        search_filters = handle_viewed_by_me_filters(search_filters, request_user_id)

    if preferred_source == "aggregated":
        replay_ids, source = _query_using_aggregated_strategy(
            search_filters=search_filters,
            sort=sort,
            organization_id=organization_id,
            project_ids=project_ids,
            period_start=period_start,
            period_stop=period_stop,
            limit=pagination.limit,
            offset=pagination.offset,
        )
    else:
        replay_ids, source = _query_using_scalar_strategy(
            search_filters=search_filters,
            sort=sort,
            organization_id=organization_id,
            project_ids=project_ids,
            period_start=period_start,
            period_stop=period_stop,
            limit=pagination.limit,
            offset=pagination.offset,
        )

    # The query "has more rows" if the number of rows found matches the limit (which is
    # the requested limit + 1).
    has_more = len(replay_ids) == pagination.limit
    if has_more:
        replay_ids.pop()

    # These replay_ids are ordered by the OrderBy expression in the query above.
    if not replay_ids:
        return QueryResponse(
            response=[],
            has_more=has_more,
            source=source,
        )

    # The final aggregation step.  Here we pass the replay_ids as the only filter.  In this step
    # we select everything and use as much memory as we need to complete the operation.
    replays = get_replays(
        project_ids,
        replay_ids,
        organization_id=organization_id,
        timestamp_start=period_start,
        timestamp_end=period_stop,
        only_query_for=set(fields),
        requesting_user_id=request_user_id,
        referrer="replays.query.browse_query",
    )

    return QueryResponse(
        response=_make_ordered(replay_ids, replays),
        has_more=has_more,
        source=source,
    )


def _query_using_scalar_strategy(
    search_filters: Sequence[QueryToken],
    sort: str | None,
    organization_id: int,
    project_ids: list[int],
    period_start: datetime,
    period_stop: datetime,
    limit: int,
    offset: int,
) -> tuple[list[str], str]:
    can_scalar_search = can_scalar_search_subquery(search_filters, period_start)
    can_scalar_sort = sort_is_scalar_compatible(sort or DEFAULT_SORT_FIELD)
    if not can_scalar_search or not can_scalar_sort:
        return _query_using_aggregated_strategy(
            search_filters=search_filters,
            sort=sort,
            organization_id=organization_id,
            project_ids=project_ids,
            period_start=period_start,
            period_stop=period_stop,
            limit=limit,
            offset=offset,
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
            search_filters=search_filters,
            sort=sort,
            organization_id=organization_id,
            project_ids=project_ids,
            period_start=period_start,
            period_stop=period_stop,
            limit=limit,
            offset=offset,
        )

    return (
        get_replay_ids(
            organization_id,
            project_ids,
            timestamp_start=period_start,
            timestamp_end=period_stop,
            where=where,
            orderby=orderby,
            limit=limit,
            offset=offset,
            referrer="organization.replay.index.scalar_search",
        ),
        "scalar-subquery",
    )


def _query_using_aggregated_strategy(
    search_filters: Sequence[QueryToken],
    sort: str | None,
    organization_id: int,
    project_ids: list[int],
    period_start: datetime,
    period_stop: datetime,
    limit: int,
    offset: int,
) -> tuple[list[str], str]:
    orderby = handle_ordering(agg_sort_config, sort or "-" + DEFAULT_SORT_FIELD)

    having: list[Condition] = handle_search_filters(agg_search_config, search_filters)
    having.append(Condition(Function("min", parameters=[Column("segment_id")]), Op.EQ, 0))

    return (
        get_replay_ids(
            organization_id,
            project_ids,
            timestamp_start=period_start,
            timestamp_end=period_stop,
            having=having,
            orderby=orderby,
            limit=limit,
            offset=offset,
            referrer="organization.replay.index.scalar_search",
        ),
        "aggregated-subquery",
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
    replay_ids = [replay_id.replace("-", "") for replay_id in replay_ids]
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
        index = replay_id_to_index[result["id"]]
        ordered_results[index] = result

    return list(filter(None, ordered_results))
