import sentry_sdk
from django.http import HttpRequest, HttpResponse
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import handle_query_errors, update_snuba_params_with_timestamp
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.organizations.services.organization import RpcOrganization
from sentry.search.events.types import SnubaParams
from sentry.snuba.trace import SerializedEvent, query_trace_data
from sentry.utils.validators import is_event_id


@region_silo_endpoint
class OrganizationTraceEndpoint(OrganizationEventsEndpointBase):
    """Replaces OrganizationEventsTraceEndpoint"""

    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get_projects(
        self,
        request: HttpRequest,
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

    @sentry_sdk.tracing.trace
    def query_trace_data(
        self,
        snuba_params: SnubaParams,
        trace_id: str,
        error_id: str | None = None,
        additional_attributes: list[str] | None = None,
        include_uptime: bool = False,
    ) -> list[SerializedEvent]:
        return query_trace_data(
            snuba_params, trace_id, error_id, additional_attributes, include_uptime
        )

    def has_feature(self, organization: Organization, request: Request) -> bool:
        return bool(
            features.has("organizations:trace-spans-format", organization, actor=request.user)
        )

    def get(self, request: Request, organization: Organization, trace_id: str) -> HttpResponse:
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

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
                    snuba_params, trace_id, error_id, additional_attributes, include_uptime
                )
            return spans

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
        )
