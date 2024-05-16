from collections.abc import Callable

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

            start = filter_params["start"]
            end = filter_params["end"]
            if start is None or end is None:
                # It's not possible to reach this point but the type hint is wrong so I have
                # to do this for completeness sake.
                return Response({"detail": "Missing start or end period."}, status=400)

            return query_replays_collection_paginated(
                project_ids=filter_params["project_id"],
                start=start,
                end=end,
                environment=filter_params.get("environment") or [],
                sort=sort,
                fields=request.query_params.getlist("field"),
                limit=limit,
                offset=offset,
                search_filters=search_filters,
                organization=organization,
                actor=request.user,
            )

        return self.paginate(
            request=request,
            paginator=ReplayPaginator(data_fn=data_fn),
            on_results=lambda results: {
                "data": process_raw_response(
                    results,
                    fields=request.query_params.getlist("field"),
                )
            },
        )


class ReplayPaginator:
    """Defers all pagination decision making to the implementation."""

    def __init__(self, data_fn: Callable[[int, int], tuple[list, bool]]) -> None:
        self.data_fn = data_fn

    def get_result(self, limit: int, cursor=None):
        assert limit > 0
        offset = int(cursor.offset) if cursor is not None else 0
        data, has_more = self.data_fn(offset, limit + 1)

        return CursorResult(
            data,
            prev=Cursor(0, max(0, offset - limit), True, offset > 0),
            next=Cursor(0, max(0, offset + limit), False, has_more),
        )
