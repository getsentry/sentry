from contextlib import contextmanager

import sentry_sdk
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import release_health
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import handle_query_errors
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.session_examples import SessionExamples
from sentry.apidocs.parameters import (
    GlobalParams,
    OrganizationParams,
    SessionsParams,
    VisibilityParams,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.exceptions import InvalidParams
from sentry.models.organization import Organization
from sentry.release_health.base import SessionsQueryResult
from sentry.snuba.sessions_v2 import SNUBA_LIMIT, InvalidField, QueryDefinition
from sentry.utils.cursors import Cursor, CursorResult


@extend_schema(tags=["Releases"])
@region_silo_endpoint
class OrganizationSessionsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    @extend_schema(
        operation_id="Retrieve Release Health Session Statistics",
        parameters=[
            GlobalParams.START,
            GlobalParams.END,
            GlobalParams.ENVIRONMENT,
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.STATS_PERIOD,
            OrganizationParams.PROJECT,
            SessionsParams.FIELD,
            SessionsParams.PER_PAGE,
            SessionsParams.INTERVAL,
            SessionsParams.GROUP_BY,
            SessionsParams.ORDER_BY,
            SessionsParams.INCLUDE_TOTALS,
            SessionsParams.INCLUDE_SERIES,
            VisibilityParams.QUERY,
        ],
        responses={
            200: inline_sentry_response_serializer("SessionsQueryResult", SessionsQueryResult),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
        },
        examples=SessionExamples.QUERY_SESSIONS,
    )
    def get(self, request: Request, organization) -> Response:
        """
        Returns a time series of release health session statistics for projects bound to an organization.

        The interval and date range are subject to certain restrictions and rounding rules.

        The date range is rounded to align with the interval, and is rounded to at least one
        hour. The interval can at most be one day and at least one hour currently. It has to cleanly
        divide one day, for rounding reasons.

        Because of technical limitations, this endpoint returns
        at most 10000 data points. For example, if you select a 90 day window grouped by releases,
        you will see at most `floor(10k / (90 + 1)) = 109` releases. To get more results, reduce the
        `statsPeriod`.
        """

        def data_fn(offset: int, limit: int) -> SessionsQueryResult:
            with self.handle_query_errors():
                with sentry_sdk.start_span(op="sessions.endpoint", name="build_sessions_query"):
                    request_limit = None
                    if request.GET.get("per_page") is not None:
                        request_limit = limit
                    request_offset = None
                    if request.GET.get("cursor") is not None:
                        request_offset = offset

                    query = self.build_sessions_query(
                        request, organization, offset=request_offset, limit=request_limit
                    )

                return release_health.backend.run_sessions_query(
                    organization.id, query, span_op="sessions.endpoint"
                )

        return self.paginate(
            request,
            paginator=SessionsDataSeriesPaginator(data_fn=data_fn),
            default_per_page=SNUBA_LIMIT,
            max_per_page=SNUBA_LIMIT,
        )

    def build_sessions_query(
        self,
        request: Request,
        organization: Organization,
        offset: int | None,
        limit: int | None,
    ):
        try:
            params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            raise NoProjects("No projects available")  # give it a description

        # HACK to prevent front-end crash when release health is sessions-based:
        query_params = request.GET.copy()
        if not release_health.backend.is_metrics_based() and request.GET.get("interval") == "10s":
            query_params["interval"] = "1m"

        query_config = release_health.backend.sessions_query_config(organization)

        return QueryDefinition(
            query=query_params,
            params=params,
            offset=offset,
            limit=limit,
            query_config=query_config,
        )

    @contextmanager
    def handle_query_errors(self):
        try:
            with handle_query_errors():
                yield
        except (InvalidField, InvalidParams, NoProjects) as error:
            raise ParseError(detail=str(error))


class SessionsDataSeriesPaginator(GenericOffsetPaginator):
    def get_result(self, limit, cursor=None):
        assert limit > 0
        offset = cursor.offset if cursor is not None else 0
        data = self.data_fn(offset=offset, limit=limit + 1)

        if isinstance(data.get("groups"), list):
            has_more = len(data["groups"]) == limit + 1
            if has_more:
                data["groups"].pop()
        else:
            raise NotImplementedError

        return CursorResult(
            data,
            prev=Cursor(0, max(0, offset - limit), True, offset > 0),
            next=Cursor(0, max(0, offset + limit), False, has_more),
        )
