from collections.abc import Callable
from typing import cast

from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import NoProjects, OrganizationEndpoint
from sentry.api.event_search import parse_search_query
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN
from sentry.apidocs.examples.replay_examples import ReplayExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.replays.post_process import ReplayDetailsResponse, process_raw_response
from sentry.replays.query import query_replays_collection_paginated, replay_url_parser_config
from sentry.replays.usecases.errors import handled_snuba_exceptions
from sentry.replays.usecases.query import PREFERRED_SOURCE, QueryResponse
from sentry.replays.validators import ReplayValidator
from sentry.utils.cursors import Cursor, CursorResult


@region_silo_endpoint
@extend_schema(tags=["Replays"])
class OrganizationReplayIndexEndpoint(OrganizationEndpoint):
    owner = ApiOwner.REPLAY
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="List an Organization's Replays",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, ReplayValidator],
        responses={
            200: inline_sentry_response_serializer("ListReplays", list[ReplayDetailsResponse]),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
        },
        examples=ReplayExamples.GET_REPLAYS,
    )
    @handled_snuba_exceptions
    def get(self, request: Request, organization: Organization) -> Response:
        """
        Return a list of replays belonging to an organization.
        """

        if not features.has("organizations:session-replay", organization, actor=request.user):
            return Response(status=404)
        try:
            filter_params = self.get_filter_params(request, organization)
        except NoProjects:
            return Response({"data": []}, status=200)

        result = ReplayValidator(data=request.GET)
        if not result.is_valid():
            raise ParseError(result.errors)

        for key, value in result.validated_data.items():
            if key not in filter_params:
                filter_params[key] = value  # type: ignore[literal-required]

        # We allow the requester to make their own decision about where to source the data.
        # Because this is a stateless, isolated interaction its okay for the user to decide where
        # to source the data. At worst they receive an exception and stop manually specifying the
        # header. This allows us to quickly test and compare multiple data sources without
        # interacting with a feature flagging system.
        preferred_source = request.headers.get("X-Preferred-Data-Source")
        preferred_source = cast(PREFERRED_SOURCE, preferred_source)

        headers = {}

        def data_fn(offset: int, limit: int):
            try:
                search_filters = parse_search_query(
                    request.query_params.get("query", ""), config=replay_url_parser_config
                )
            except InvalidSearchQuery as e:
                raise ParseError(str(e))

            # Sort must be optional string.
            sort = filter_params.get("sort")
            if not isinstance(sort, str):
                sort = None

            response = query_replays_collection_paginated(
                project_ids=filter_params["project_id"],
                start=filter_params["start"],
                end=filter_params["end"],
                environment=filter_params.get("environment") or [],
                sort=sort,
                fields=request.query_params.getlist("field"),
                limit=limit,
                offset=offset,
                search_filters=search_filters,
                preferred_source=preferred_source,
                organization=organization,
                actor=request.user,
            )

            # We set the data-source header so we can figure out which query is giving
            # incorrect or slow results.
            headers["X-Data-Source"] = response.source

            return response

        response = self.paginate(
            request=request,
            paginator=ReplayPaginator(data_fn=data_fn),
            on_results=lambda results: {
                "data": process_raw_response(
                    results,
                    fields=request.query_params.getlist("field"),
                )
            },
        )

        for header, value in headers.items():
            response[header] = value

        return response


class ReplayPaginator:
    """Defers all pagination decision making to the implementation."""

    def __init__(self, data_fn: Callable[[int, int], QueryResponse]) -> None:
        self.data_fn = data_fn

    def get_result(self, limit: int, cursor=None):
        assert limit > 0
        offset = int(cursor.offset) if cursor is not None else 0
        response = self.data_fn(offset, limit + 1)

        return CursorResult(
            response.response,
            prev=Cursor(0, max(0, offset - limit), True, offset > 0),
            next=Cursor(0, max(0, offset + limit), False, response.has_more),
        )
