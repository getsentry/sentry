from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Granularity,
    Limit,
    Offset,
    Op,
    OrderBy,
    Query,
)
from snuba_sdk import Request as SnubaRequest

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import NoProjects, OrganizationEndpoint
from sentry.api.event_search import SearchConfig
from sentry.api.paginator import GenericOffsetPaginator
from sentry.models.organization import Organization
from sentry.replays.lib.query import Number, QueryConfig, get_valid_sort_commands
from sentry.replays.query import Paginators, make_pagination_values
from sentry.replays.validators import ReplaySelectorValidator
from sentry.utils.snuba import raw_snql_query


@region_silo_endpoint
class OrganizationReplaySelectorIndexEndpoint(OrganizationEndpoint):
    def get_replay_filter_params(self, request, organization):
        filter_params = self.get_filter_params(request, organization)

        has_global_views = features.has(
            "organizations:global-views", organization, actor=request.user
        )
        if not has_global_views and len(filter_params.get("project_id", [])) > 1:
            raise ParseError(detail="You cannot view events from multiple projects.")

        return filter_params

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
            return query_selector_collection(
                project_ids=filter_params["project_id"],
                start=filter_params["start"],
                end=filter_params["end"],
                sort=filter_params.get("sort"),
                limit=limit,
                offset=offset,
                organization=organization,
            )

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            on_results=lambda results: {"data": process_raw_response(results)},
        )


selector_search_config = SearchConfig(numeric_keys={"count_dead_clicks", "count_rage_clicks"})


class SelectorQueryConfig(QueryConfig):
    count_dead_clicks = Number()
    count_rage_clicks = Number()


def query_selector_collection(
    project_ids: List[int],
    start: datetime,
    end: datetime,
    sort: Optional[str],
    limit: Optional[str],
    offset: Optional[str],
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
        pagination=paginators,
        sort=sort,
        tenant_ids=tenant_ids,
    )
    return response["data"]


def query_selector_dataset(
    project_ids: List[int],
    start: datetime,
    end: datetime,
    pagination: Optional[Paginators],
    sort: Optional[str],
    tenant_ids: dict[str, Any] | None = None,
):
    query_options = {}

    if pagination:
        query_options["limit"] = Limit(pagination.limit)
        query_options["offset"] = Offset(pagination.offset)

    sorting = get_valid_sort_commands(
        sort,
        default=OrderBy(Column("count_dead_clicks"), Direction.DESC),
        query_config=SelectorQueryConfig(),
    )

    snuba_request = SnubaRequest(
        dataset="replays",
        app_id="replay-backend-web",
        query=Query(
            match=Entity("replays"),
            select=[
                Column("click_tag"),
                Column("click_id"),
                Column("click_class"),
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
            ],
            orderby=sorting,
            groupby=[
                Column("click_tag"),
                Column("click_id"),
                Column("click_class"),
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
    return raw_snql_query(snuba_request, "replays.query.query_replays_dataset")


def process_raw_response(response: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Process the response further into the expected output."""

    def make_selector_name(row) -> str:
        selector = row["click_tag"]

        if row["click_id"]:
            selector = selector + f"#{row['click_id']}"
        if row["click_class"]:
            selector = selector + "." + ".".join(row["click_class"])

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
            "dom_element": make_selector_name(row),
            "count_dead_clicks": row["count_dead_clicks"],
            "count_rage_clicks": row["count_rage_clicks"],
        }
        for row in response
    ]
