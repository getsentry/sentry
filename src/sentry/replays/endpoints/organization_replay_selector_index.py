from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional, Union

from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import (
    Column,
    Condition,
    Entity,
    Function,
    Granularity,
    Identifier,
    Lambda,
    Limit,
    Offset,
    Op,
    Query,
)
from snuba_sdk import Request as SnubaRequest

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import NoProjects, OrganizationEndpoint
from sentry.api.event_search import ParenExpression, SearchFilter, parse_search_query
from sentry.api.paginator import GenericOffsetPaginator
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.replays.lib.new_query.conditions import IntegerScalar
from sentry.replays.lib.new_query.fields import FieldProtocol, IntegerColumnField
from sentry.replays.lib.new_query.parsers import parse_int
from sentry.replays.query import make_pagination_values
from sentry.replays.usecases.errors import handled_snuba_exceptions
from sentry.replays.usecases.query import Paginators, handle_ordering, handle_search_filters
from sentry.replays.validators import ReplaySelectorValidator
from sentry.utils.snuba import raw_snql_query


@region_silo_endpoint
class OrganizationReplaySelectorIndexEndpoint(OrganizationEndpoint):
    owner = ApiOwner.REPLAY
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get_replay_filter_params(self, request, organization):
        filter_params = self.get_filter_params(request, organization)

        has_global_views = features.has(
            "organizations:global-views", organization, actor=request.user
        )
        if not has_global_views and len(filter_params.get("project_id", [])) > 1:
            raise ParseError(detail="You cannot view events from multiple projects.")

        return filter_params

    @handled_snuba_exceptions
    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:session-replay", organization, actor=request.user):
            return Response(status=404)
        try:
            filter_params = self.get_replay_filter_params(request, organization)
        except NoProjects:
            return Response({"data": []}, status=200)

        result = ReplaySelectorValidator(data=request.GET)
        if not result.is_valid():
            raise ParseError(result.errors)

        for key, value in result.validated_data.items():
            if key not in filter_params:
                filter_params[key] = value

        def data_fn(offset, limit):
            try:
                search_filters = parse_search_query(request.query_params.get("query", ""))
            except InvalidSearchQuery as e:
                raise ParseError(str(e))

            return query_selector_collection(
                project_ids=filter_params["project_id"],
                start=filter_params["start"],
                end=filter_params["end"],
                sort=filter_params.get("sort"),
                limit=limit,
                offset=offset,
                search_filters=search_filters,
                organization=organization,
            )

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            on_results=lambda results: {"data": process_raw_response(results)},
        )


def query_selector_collection(
    project_ids: List[int],
    start: datetime,
    end: datetime,
    sort: Optional[str],
    limit: Optional[str],
    offset: Optional[str],
    search_filters: List[Condition],
    organization: Organization,
) -> dict:
    """Query aggregated replay collection."""
    if organization:
        tenant_ids = {"organization_id": organization.id}
    else:
        tenant_ids = {}

    paginators = make_pagination_values(limit, offset)

    response = query_selector_dataset(
        project_ids=project_ids,
        start=start,
        end=end,
        search_filters=search_filters,
        pagination=paginators,
        sort=sort,
        tenant_ids=tenant_ids,
    )
    return response["data"]


def query_selector_dataset(
    project_ids: List[int],
    start: datetime,
    end: datetime,
    search_filters: List[Union[SearchFilter, ParenExpression, str]],
    pagination: Optional[Paginators],
    sort: Optional[str],
    tenant_ids: dict[str, Any] | None = None,
):
    query_options = {}

    if pagination:
        query_options["limit"] = Limit(pagination.limit)
        query_options["offset"] = Offset(pagination.offset)

    conditions = handle_search_filters(query_config, search_filters)
    sorting = handle_ordering(sort_config, sort or "-count_dead_clicks")

    # Pre-fetch the number of replays in the set.
    #
    # NOTE: The date values have their seconds precision stripped. This is done so our queries
    # will be cached. The number of rows in the set won't materially change on a minute by minute
    # basis. We could extend this to use hourly or daily precision.
    count_start = start.replace(second=0)
    count_end = end.replace(second=0)

    count_query = SnubaRequest(
        dataset="replays",
        app_id="replay-backend-web",
        query=Query(
            match=Entity("replays"),
            select=[
                Function("count", parameters=[Column("replay_id")]),
            ],
            where=[
                Condition(Column("project_id"), Op.IN, project_ids),
                Condition(Column("timestamp"), Op.GTE, count_start),
                Condition(Column("timestamp"), Op.LT, count_end),
            ],
            granularity=Granularity(3600),
        ),
        tenant_ids=tenant_ids,
    )
    result = raw_snql_query(count_query, "replays.query.query_selector_index_count")

    # The sample rate is computed such that we will only ever aggregate a maximum of 1M rows.
    num_rows = result["data"][0]["count(replay_id)"]
    sample_rate = (num_rows // 1_000_000) + 1

    snuba_request = SnubaRequest(
        dataset="replays",
        app_id="replay-backend-web",
        query=Query(
            match=Entity("replays"),
            select=[
                Column("project_id"),
                Column("click_tag"),
                Column("click_id"),
                Function(
                    "arrayFilter",
                    parameters=[
                        Lambda(
                            ["v"],
                            Function("notEquals", parameters=[Identifier("v"), ""]),
                        ),
                        Column("click_class"),
                    ],
                    alias="click_class_filtered",
                ),
                Column("click_role"),
                Column("click_alt"),
                Column("click_testid"),
                Column("click_aria_label"),
                Column("click_title"),
                Function("sum", parameters=[Column("click_is_dead")], alias="count_dead_clicks"),
                Function("sum", parameters=[Column("click_is_rage")], alias="count_rage_clicks"),
            ],
            where=[
                Condition(Column("project_id"), Op.IN, project_ids),
                Condition(Column("timestamp"), Op.LT, end),
                Condition(Column("timestamp"), Op.GTE, start),
                Condition(Column("click_tag"), Op.NEQ, ""),
                Condition(
                    Function(
                        "modulo",
                        parameters=[
                            Function("cityHash64", parameters=[Column("replay_id")]),
                            sample_rate,
                        ],
                    ),
                    Op.EQ,
                    0,
                ),
            ],
            having=conditions,
            orderby=sorting,
            groupby=[
                Column("project_id"),
                Column("click_tag"),
                Column("click_id"),
                Column("click_class_filtered"),
                Column("click_role"),
                Column("click_alt"),
                Column("click_testid"),
                Column("click_aria_label"),
                Column("click_title"),
            ],
            granularity=Granularity(3600),
            **query_options,
        ),
        tenant_ids=tenant_ids,
    )
    return raw_snql_query(snuba_request, "replays.query.query_selector_index")


def process_raw_response(response: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Process the response further into the expected output."""

    def make_selector_name(row) -> str:
        selector = row["click_tag"]

        if row["click_id"]:
            selector = selector + f"#{row['click_id']}"
        if row["click_class_filtered"]:
            selector = selector + "." + ".".join(row["click_class_filtered"])

        if row["click_role"]:
            selector = selector + f'[role="{row["click_role"]}"]'
        if row["click_alt"]:
            selector = selector + f'[alt="{row["click_alt"]}"]'
        if row["click_testid"]:
            selector = selector + f'[testid="{row["click_testid"]}"]'
        if row["click_aria_label"]:
            selector = selector + f'[aria="{row["click_aria_label"]}"]'
        if row["click_title"]:
            selector = selector + f'[title="{row["click_title"]}"]'

        return selector

    return [
        {
            "count_dead_clicks": row["count_dead_clicks"],
            "count_rage_clicks": row["count_rage_clicks"],
            "dom_element": make_selector_name(row),
            "element": {
                "alt": row["click_alt"],
                "aria_label": row["click_aria_label"],
                "class": row["click_class_filtered"],
                "id": row["click_id"],
                "project_id": row["project_id"],
                "role": row["click_role"],
                "tag": row["click_tag"],
                "testid": row["click_testid"],
                "title": row["click_title"],
            },
            "project_id": row["project_id"],
        }
        for row in response
    ]


query_config: dict[str, FieldProtocol] = {
    "count_dead_clicks": IntegerColumnField("count_dead_clicks", parse_int, IntegerScalar),
    "count_rage_clicks": IntegerColumnField("count_rage_clicks", parse_int, IntegerScalar),
}

sort_config = {
    "count_dead_clicks": Column("count_dead_clicks"),
    "count_rage_clicks": Column("count_rage_clicks"),
}
