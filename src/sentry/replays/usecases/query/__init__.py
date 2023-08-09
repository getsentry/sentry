from __future__ import annotations

from collections import namedtuple
from datetime import datetime, timedelta
from typing import Union

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
from sentry.replays.lib.new_query.fields import BaseField
from sentry.utils.snuba import raw_snql_query


def handle_search_filters(
    search_config: dict[str, BaseField],
    search_filters: list[Union[SearchFilter, str, ParenExpression]],
) -> list[Condition]:
    """Convert search filters to snuba conditions."""
    result: list[Condition] = []
    look_back = None
    for search_filter in search_filters:
        # SearchFilters are appended to the result set.  If they are top level filters they are
        # implicitly And'ed in the WHERE/HAVING clause.
        if isinstance(search_filter, SearchFilter):
            condition = search_filter_to_condition(search_config, search_filter)
            if look_back == "AND":
                look_back = None
                attempt_compressed_condition(result, condition, And)
            elif look_back == "OR":
                look_back = None
                attempt_compressed_condition(result, condition, Or)
            else:
                result.append(condition)
        # ParenExpressions are recursively computed.  If more than one condition is returned then
        # those conditions are And'ed.
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
    condition_type: Union[And, Or],
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
    search_config: dict[str, BaseField],
    search_filter: SearchFilter,
) -> Condition:
    field_name = search_filter.key.name
    field = search_config.get(field_name)
    if field:
        return field.apply(search_filter)
    else:
        field = search_config["*"]
        if field_name.startswith("tags["):
            field_name = field_name[5:-1]
        return field.apply(field_name, search_filter)


# Everything below here will move to replays/query.py once we deprecate the old query behavior.
# Leaving it here for now so this is easier to review/remove.
from sentry.replays.usecases.query.configs.aggregate import search_config as agg_search_config
from sentry.replays.usecases.query.configs.aggregate_sort import sort_config as agg_sort_config

Paginators = namedtuple("Paginators", ("limit", "offset"))


def query_using_aggregated_search(
    fields: list[str],
    search_filters: list[Union[SearchFilter, str, ParenExpression]],
    environments: list[str],
    sort: str | None,
    pagination: Paginators | None,
    organization: Organization | None,
    project_ids: list[int],
    period_start: datetime,
    period_stop: datetime,
):
    tenant_ids = _make_tenant_ids(organization)

    if sort is None:
        sorting = [OrderBy(agg_sort_config["started_at"], Direction.DESC)]
    elif sort.startswith("-"):
        sorting = [OrderBy(agg_sort_config[sort[1:]], Direction.DESC)]
    else:
        sorting = [OrderBy(agg_sort_config[sort], Direction.ASC)]

    # Environments is provided to us outside of the ?query= url parameter. It's stil filtered like
    # the values in that parameter so let's shove it inside and process it like any other filter.
    if environments:
        search_filters.append(
            SearchFilter(SearchKey("environment"), "IN", SearchValue(environments))
        )

    # Simple aggregation steps.
    simple_aggregation_query = make_simple_aggregation_query(
        search_filters=search_filters,
        orderby=sorting,
        project_ids=project_ids,
        period_start=period_start,
        period_stop=period_stop,
    )
    if pagination:
        simple_aggregation_query = simple_aggregation_query.set_limit(pagination.limit)
        simple_aggregation_query = simple_aggregation_query.set_offset(pagination.offset)

    simple_aggregation_response = raw_snql_query(
        Request(
            dataset="replays",
            app_id="replay-backend-web",
            query=simple_aggregation_query,
            tenant_ids=tenant_ids,
        ),
        "replays.query.browse_simple_aggregation",
    )

    # Collection step.
    replay_ids = [row["replay_id"] for row in simple_aggregation_response.get("data", [])]

    # Final aggregation step.
    results = raw_snql_query(
        Request(
            dataset="replays",
            app_id="replay-backend-web",
            query=make_full_aggregation_query(
                fields=fields,
                replay_ids=replay_ids,
                project_ids=project_ids,
                period_start=period_start,
                period_end=period_stop,
            ),
            tenant_ids=tenant_ids,
        ),
        "replays.query.browse_points",
    )["data"]

    # A weird snuba-ism.  You can't sort by an aggregation that is also present in the select.
    # Even if the aggregations are different.  So we have to fallback to sorting on the
    # application server.
    #
    # For example these are all examples of valid SQL that are not possible with Snuba.
    #
    #   SELECT any(os_name)
    #   FROM replays_local
    #   GROUP BY replay_id
    #   ORDER BY any(os_name)
    #
    #   SELECT anyIf(os_name, notEmpty(os_name))
    #   FROM replays_local
    #   GROUP BY replay_id
    #   ORDER BY any(os_name)
    ordered_results = []

    # TODO: O(n^2)! Very exciting.
    for replay_id in replay_ids:
        for result in results:
            if result["replay_id"] == replay_id:
                ordered_results.append(result)
                break

    return ordered_results


def make_simple_aggregation_query(
    search_filters: list[Union[SearchFilter, str, ParenExpression]],
    orderby: list[OrderBy],
    project_ids: list[int],
    period_start: datetime,
    period_stop: datetime,
) -> Query:
    having = handle_search_filters(agg_search_config, search_filters)

    return Query(
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


def make_full_aggregation_query(
    fields: list[str],
    replay_ids: list[str],
    project_ids: list[int],
    period_start: datetime,
    period_end: datetime,
) -> Query:
    """Return a query to fetch every replay in the set."""
    from sentry.replays.query import QUERY_ALIAS_COLUMN_MAP, select_from_fields

    def _select_from_fields() -> list[Union[Column, Function]]:
        if fields:
            return select_from_fields(list(set(fields)))
        else:
            return list(QUERY_ALIAS_COLUMN_MAP.values())

    return Query(
        match=Entity("replays"),
        select=_select_from_fields(),
        where=[
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("replay_id"), Op.IN, replay_ids),
            # We can scan an extended time range to account for replays which span either end of
            # the range.  These timestamps are an optimization and could be removed with minimal
            # performance impact.  It's a point query.  Its super fast.
            Condition(Column("timestamp"), Op.GTE, period_start - timedelta(hours=1)),
            Condition(Column("timestamp"), Op.LT, period_end + timedelta(hours=1)),
        ],
        groupby=[Column("project_id"), Column("replay_id")],
        granularity=Granularity(3600),
    )


def _make_tenant_ids(organization: Organization) -> dict[str, int]:
    if organization:
        return {"organization_id": organization.id}
    else:
        return {}
