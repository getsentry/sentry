from __future__ import annotations

import datetime
import uuid
from typing import Union

from rest_framework.exceptions import ParseError
from rest_framework.response import Response
from snuba_sdk import (
    And,
    Column,
    Condition,
    Entity,
    Function,
    Granularity,
    Limit,
    Offset,
    Op,
    Or,
    OrderBy,
    Query,
    Request,
)
from snuba_sdk.expressions import Expression
from snuba_sdk.orderby import Direction

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.event_search import ParenExpression, SearchFilter, parse_search_query
from sentry.api.paginator import GenericOffsetPaginator
from sentry.exceptions import InvalidSearchQuery
from sentry.models.project import Project
from sentry.replays.lib.query import (
    Field,
    ListField,
    QueryConfig,
    String,
    attempt_compressed_condition,
    filter_to_condition,
)
from sentry.replays.lib.selector.parse import QueryType, parse_selector
from sentry.utils.snuba import raw_snql_query

REFERRER = "replays.query.query_replay_clicks_dataset"


@region_silo_endpoint
class ProjectReplayClicksIndexEndpoint(ProjectEndpoint):
    def get(self, request: Request, project: Project, replay_id: str) -> Response:
        if not features.has(
            "organizations:session-replay", project.organization, actor=request.user
        ):
            return Response(status=404)

        filter_params = self.get_filter_params(request, project)

        try:
            replay_id = str(uuid.UUID(replay_id))
        except ValueError:
            return Response(status=404)

        def data_fn(offset, limit):
            try:
                search_filters = parse_search_query(request.query_params.get("query", ""))
            except InvalidSearchQuery as e:
                raise ParseError(str(e))

            return query_replay_clicks(
                project_id=filter_params["project_id"][0],
                replay_id=replay_id,
                start=filter_params["start"],
                end=filter_params["end"],
                limit=limit,
                offset=offset,
                search_filters=search_filters,
            )

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            on_results=lambda results: {"data": results["data"]},
        )


def query_replay_clicks(
    project_id: int,
    replay_id: str,
    start: datetime.datetime,
    end: datetime.datetime,
    limit: int,
    offset: int,
    search_filters: SearchFilter,
):
    """Query replay clicks.

    This query is atypical in that it does not aggregate by replay_id and it is not exposed as a
    user facing endpoint.  This query enables the replays client to fetch click information for
    queries that were written for the replays index endpoint.  In other words, we need to translate
    a list of conditions meant for an aggregated query into a list of conditions against a
    non-aggregated query.  This means most of our ANDs become logical ORs and negation queries do
    not logically filter any results.

    Why do most ANDs become logical ORs?  Our query has been pre-validated to contain the result.
    We know this replay matches the query now we just need to find the component parts that
    created the match.  Because the filter (tag = "div" AND id = "button") works in an aggregated
    context every row in the aggregation contributes to the result.  So in our query of a
    pre-fetched result we know a single row could match both conditions or multiple rows could
    match either condition independently.  Either case constitutes a successful response.  In the
    case of selector matches those "AND" conditions will apply because they require a single row
    matches all the conditions to produce the aggregated result set.

    Why do negation queries have no impact?  Because if the aggregated result does not contain a
    condition (e.g. tag = "button") then no row in the subset of the aggregation can logically
    contain it.  We could remove these conditions but it is irrelevant to the output.  They are
    logically disabled by the nature of the context they operate in.

    If these conditions only apply to aggregated results why do we not aggregate here and simplify
    our implementation?  Because aggregation precludes the ability to paginate.  There is no other
    reason.
    """
    conditions = generate_pregrouped_conditions(
        search_filters,
        query_config=ReplayClicksQueryConfig(),
    )
    if len(conditions) > 1:
        conditions = [Or(conditions)]

    snuba_request = Request(
        dataset="replays",
        app_id="replay-backend-web",
        query=Query(
            match=Entity("replays"),
            select=[
                Function("identity", parameters=[Column("click_node_id")], alias="node_id"),
                Column("timestamp"),
            ],
            where=[
                Condition(Column("project_id"), Op.EQ, project_id),
                Condition(Column("timestamp"), Op.GTE, start),
                Condition(Column("timestamp"), Op.LT, end),
                Condition(Column("replay_id"), Op.EQ, replay_id),
                # This is a hueristic to only evaluate valid rows. All click events will have
                # a tag associated.  This condition allows the endpoint to return all valid click
                # events if the query parameter was not provided.
                Condition(Column("click_tag"), Op.NEQ, ""),
                # Allow for click lookups using a subset of the index query configuration.
                *conditions,
            ],
            orderby=[OrderBy(Column("timestamp"), Direction.ASC)],
            limit=Limit(limit),
            offset=Offset(offset),
            granularity=Granularity(3600),
        ),
    )
    return raw_snql_query(snuba_request, REFERRER)


class Selector(Field):
    _operators = [Op.EQ, Op.NEQ]
    _python_type = str

    def as_condition(
        self, field_alias: str, operator: Op, value: Union[list[str], str], is_wildcard: bool
    ) -> Condition:
        if operator == Op.NEQ:
            return Condition(Function("identity", parameters=[1]), Op.EQ, 2)

        # This list of queries implies an `OR` operation between each item in the set. To `AND`
        # selector queries apply them separately.
        queries: list[QueryType] = parse_selector(value)

        # A valid selector will always return at least one query condition. If this did not occur
        # then the selector was not well-formed. We return an empty resultset.
        if len(queries) == 0:
            return Condition(Function("identity", parameters=[1]), Op.EQ, 2)

        # Conditions are pre-made and intended for application in the HAVING clause.
        conditions: list[Condition] = []

        for query in queries:
            if query.alt:
                conditions.append(Condition(Column("click_alt"), operator, query.alt))
            if query.aria_label:
                conditions.append(Condition(Column("click_aria_label"), operator, query.aria_label))
            if query.classes:
                conditions.append(
                    Condition(
                        Function("hasAll", parameters=[Column("click_class"), query.classes]),
                        Op.EQ,
                        1,
                    )
                )
            if query.id:
                conditions.append(Condition(Column("click_id"), operator, query.id))
            if query.role:
                conditions.append(Condition(Column("click_role"), operator, query.role))
            if query.tag:
                conditions.append(Condition(Column("click_tag"), operator, query.tag))
            if query.testid:
                conditions.append(Condition(Column("click_testid"), operator, query.testid))
            if query.title:
                conditions.append(Condition(Column("click_title"), operator, query.title))

        if len(conditions) == 1:
            return conditions[0]
        else:
            return And(conditions)


class ReplayClicksQueryConfig(QueryConfig):
    click_alt = String(field_alias="click.alt")
    click_class = ListField(field_alias="click.class")
    click_id = String(field_alias="click.id")
    click_aria_label = String(field_alias="click.label")
    click_role = String(field_alias="click.role")
    click_tag = String(field_alias="click.tag")
    click_testid = String(field_alias="click.testid")
    click_text = String(field_alias="click.textContent")
    click_title = String(field_alias="click.title")
    click_selector = Selector(field_alias="click.selector")


def generate_pregrouped_conditions(
    query: list[Union[SearchFilter, ParenExpression, str]],
    query_config: QueryConfig,
) -> list[Expression]:
    """Convert search filters to snuba conditions.

    AND conditions are coerced to OR conditions.  This is because we're operating over a
    multi-row set but each filter was written under the assumption we were analyzing a single
    row.  AND conditions are still possible using the selector syntax.
    """
    result: list[Expression] = []
    look_back = None
    for search_filter in query:
        # SearchFilters are appended to the result set.  If they are top level filters they are
        # implicitly And'ed in the WHERE/HAVING clause.
        if isinstance(search_filter, SearchFilter):
            condition = filter_to_condition(search_filter, query_config)
            if look_back == "OR" or look_back == "AND":
                look_back = None
                attempt_compressed_condition(result, condition, Or)
            else:
                result.append(condition)
        # ParenExpressions are recursively computed.  If more than one condition is returned then
        # those conditions are And'ed.
        elif isinstance(search_filter, ParenExpression):
            conditions = generate_pregrouped_conditions(search_filter.children, query_config)
            if len(conditions) < 2:
                result.extend(conditions)
            else:
                result.append(Or(conditions))
        # String types are limited to AND and OR... I think?  In the case where its not a valid
        # look-back it is implicitly ignored.
        elif isinstance(search_filter, str):
            look_back = search_filter

    return result
