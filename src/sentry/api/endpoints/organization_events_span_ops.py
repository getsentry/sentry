from typing import TypedDict

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import handle_query_errors
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import (
    CursorQueryParam,
    GlobalParams,
    OrganizationParams,
    VisibilityParams,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.snuba.dataset import Dataset
from sentry.utils.snuba import raw_snql_query


class SpanOp(TypedDict):
    op: str
    count: int


@extend_schema(tags=["Discover"])
@cell_silo_endpoint
class OrganizationEventsSpanOpsEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="listOrganizationEventsSpanOps",
        summary="List Span Operations",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            GlobalParams.ENVIRONMENT,
            GlobalParams.STATS_PERIOD,
            GlobalParams.START,
            GlobalParams.END,
            VisibilityParams.QUERY,
            OpenApiParameter(
                name="per_page",
                location="query",
                required=False,
                type=int,
                description="The number of span operations to return. Defaults to and cannot exceed 20.",
            ),
            CursorQueryParam,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationEventsSpanOpsResponse", list[SpanOp]
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """
        Return the span operations found in transactions matching the query, ordered by how
        many spans have each operation.
        """
        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        query = request.GET.get("query")

        def data_fn(offset: int, limit: int) -> list[SpanOp]:
            builder = DiscoverQueryBuilder(
                dataset=Dataset.Discover,
                params={},
                snuba_params=snuba_params,
                selected_columns=["spans_op", "count()"],
                array_join="spans_op",
                query=query,
                limit=limit,
                offset=offset,
                orderby="-count",
            )
            snql_query = builder.get_snql_query()
            snql_query.tenant_ids = {"organization_id": organization.id}
            results = raw_snql_query(snql_query, "api.organization-events-span-ops")
            return [SpanOp(op=row["spans_op"], count=row["count"]) for row in results["data"]]

        with handle_query_errors():
            return self.paginate(
                request,
                paginator=GenericOffsetPaginator(data_fn=data_fn),
                default_per_page=20,
                max_per_page=20,
            )
