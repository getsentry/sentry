from __future__ import annotations

import datetime
import uuid
from typing import Union

from rest_framework.exceptions import ParseError
from rest_framework.response import Response
from snuba_sdk import (
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
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.event_search import ParenExpression, SearchFilter, parse_search_query
from sentry.api.paginator import GenericOffsetPaginator
from sentry.exceptions import InvalidSearchQuery
from sentry.models.project import Project
from sentry.replays.lib.query import (
    ListField,
    QueryConfig,
    String,
    WhereSelector,
    attempt_compressed_condition,
    filter_to_condition,
)
from sentry.utils.snuba import raw_snql_query

REFERRER = "replays.query.query_replay_clicks_dataset"


class ReplayDetailsPermission(ProjectPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin"],
        "POST": ["project:write", "project:admin"],
        "PUT": ["project:write", "project:admin"],
        "DELETE": ["project:read", "project:write", "project:admin"],
    }


@region_silo_endpoint
class ProjectReplayClicksIndexEndpoint(ProjectEndpoint):

    permission_classes = (ReplayDetailsPermission,)

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
    click_selector = WhereSelector(field_alias="click.selector")


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
