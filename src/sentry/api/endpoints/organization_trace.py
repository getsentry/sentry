from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import handle_query_errors, update_snuba_params_with_timestamp
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.trace_examples import TraceExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.organizations.services.organization import RpcOrganization
from sentry.search.events.types import SnubaParams
from sentry.snuba.trace import (
    SerializedEvent,
    SerializedIssue,
    SerializedSpan,
    SerializedUptimeCheck,
    query_trace_data,
)
from sentry.utils.tracing import trace
from sentry.utils.validators import is_event_id

TRACE_ID_PATH_PARAM = OpenApiParameter(
    name="trace_id",
    location="path",
    required=True,
    type=str,
    description="The ID of the trace, a 32-character hexadecimal string.",
)

REFERRER_QUERY_PARAM = OpenApiParameter(
    name="referrer",
    location="query",
    required=False,
    type=str,
    description="Internal referrer identifier used for query tracing. Most clients can omit this.",
)

ERROR_ID_QUERY_PARAM = OpenApiParameter(
    name="errorId",
    location="query",
    required=False,
    type=str,
    description="A 32-character hexadecimal event ID to bias the trace results toward including.",
)

ADDITIONAL_ATTRIBUTES_PARAM = OpenApiParameter(
    name="additional_attributes",
    location="query",
    required=False,
    many=True,
    type=str,
    description="Additional span attributes to include on each event. Repeat to request multiple.",
)

INCLUDE_UPTIME_PARAM = OpenApiParameter(
    name="include_uptime",
    location="query",
    required=False,
    type=str,
    enum=["0", "1"],
    description="Set to `1` to include uptime check results in the trace. Defaults to `0`.",
)


@extend_schema(tags=["Discover"])
@cell_silo_endpoint
class OrganizationTraceEndpoint(OrganizationEventsEndpointBase):
    """Replaces OrganizationEventsTraceEndpoint"""

    owner = ApiOwner.EXPLORE
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    def get_projects(
        self,
        request: Request,
        organization: Organization | RpcOrganization,
        force_global_perms: bool = False,
        include_all_accessible: bool = False,
        project_ids: set[int] | None = None,
        project_slugs: set[str] | None = None,
    ) -> list[Project]:
        """The trace endpoint always wants to get all projects regardless of what's passed into the API

        This is because a trace can span any number of projects in an organization. But we still want to
        use the get_projects function to check for any permissions. So we'll just pass project_ids=-1 everytime
        which is what would be sent if we wanted all projects"""
        return super().get_projects(
            request,
            organization,
            project_ids={-1},
            project_slugs=None,
            include_all_accessible=True,
        )

    @trace
    def query_trace_data(
        self,
        snuba_params: SnubaParams,
        trace_id: str,
        referrer: str | None,
        error_id: str | None = None,
        additional_attributes: list[str] | None = None,
        include_uptime: bool = False,
        *,
        organization: Organization,
    ) -> list[SerializedEvent]:
        return query_trace_data(
            snuba_params,
            trace_id,
            referrer,
            error_id,
            additional_attributes,
            include_uptime,
            organization=organization,
        )

    @extend_schema(
        operation_id="getOrganizationTrace",
        summary="Retrieve a Trace",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            TRACE_ID_PATH_PARAM,
            GlobalParams.STATS_PERIOD,
            GlobalParams.START,
            GlobalParams.END,
            REFERRER_QUERY_PARAM,
            ERROR_ID_QUERY_PARAM,
            ADDITIONAL_ATTRIBUTES_PARAM,
            INCLUDE_UPTIME_PARAM,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationTraceResponse",
                list[SerializedSpan | SerializedIssue | SerializedUptimeCheck],
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=TraceExamples.TRACE,
    )
    def get(
        self, request: Request, organization: Organization, trace_id: str
    ) -> Response[list[SerializedSpan | SerializedIssue | SerializedUptimeCheck]] | Response[None]:
        """
        Retrieve the spans, errors, and (optionally) uptime checks that make up a single trace.

        The response is a list of top-level events; each item may have nested `children`, `errors`,
        and `occurrences` arrays representing related items. Top-level entries are spans by default
        and may also be uptime checks when `include_uptime=1` is passed.
        """
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        referrer = request.GET.get("referrer")

        additional_attributes = request.GET.getlist("additional_attributes", [])
        include_uptime = request.GET.get("include_uptime", "0") == "1"

        error_id = request.GET.get("errorId")
        if error_id is not None and not is_event_id(error_id):
            raise ParseError(f"eventId: {error_id} needs to be a valid uuid")

        def data_fn(offset: int, limit: int) -> list[SerializedEvent]:
            """offset and limit don't mean anything on this endpoint currently"""
            with handle_query_errors():
                update_snuba_params_with_timestamp(request, snuba_params)

                spans = self.query_trace_data(
                    snuba_params,
                    trace_id,
                    referrer,
                    error_id,
                    additional_attributes,
                    include_uptime,
                    organization=organization,
                )
            return spans

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
        )
