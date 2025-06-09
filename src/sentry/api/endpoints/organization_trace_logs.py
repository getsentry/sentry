import sentry_sdk
from django.http import HttpRequest, HttpResponse
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import handle_query_errors, update_snuba_params_with_timestamp
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.organizations.services.organization import RpcOrganization
from sentry.search.events.types import EventsResponse, SnubaParams
from sentry.snuba import ourlogs
from sentry.snuba.referrer import Referrer
from sentry.utils.validators import INVALID_ID_DETAILS, is_event_id


@region_silo_endpoint
class OrganizationTraceLogsEndpoint(OrganizationEventsV2EndpointBase):
    """Replaces a call to events that isn't possible for team plans because of projects restrictions"""

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
    def query_logs_data(
        self,
        snuba_params: SnubaParams,
        trace_ids: list[str],
        orderby: list[str],
        additional_query: str | None,
        offset: int,
        limit: int,
    ) -> EventsResponse:
        """Queries log data for a given trace"""
        selected_columns = [
            "sentry.item_id",
            "project.id",
            "trace",
            "severity_number",
            "severity",
            "timestamp",
            "tags[sentry.timestamp_precise,number]",
            "message",
        ]
        for column in orderby:
            if column.lstrip("-") not in selected_columns:
                raise ParseError(
                    f"{column.lstrip('-')} must be one of {','.join(selected_columns)}"
                )
        base_query = (
            f"trace:{trace_ids[0]}" if len(trace_ids) == 1 else f"trace:[{','.join(trace_ids)}]"
        )
        if additional_query is not None:
            query = f"{base_query} and {additional_query}"
        else:
            query = base_query
        results = ourlogs.query(
            selected_columns=selected_columns,
            query=query,
            snuba_params=snuba_params,
            orderby=orderby,
            offset=offset,
            limit=limit,
            referrer=Referrer.API_TRACE_VIEW_LOGS.value,
        )
        return results

    def get(self, request: Request, organization: Organization) -> HttpResponse:
        try:
            # The trace view isn't useful without global views, so skipping the check here
            snuba_params = self.get_snuba_params(request, organization, check_global_views=False)
        except NoProjects:
            return Response(status=404)

        trace_ids = request.GET.getlist("traceId", [])
        for trace_id in trace_ids:
            if not is_event_id(trace_id):
                raise ParseError(INVALID_ID_DETAILS.format(trace_id))
        if len(trace_ids) == 0:
            raise ParseError("Need to pass at least one traceId")

        orderby = request.GET.getlist("orderby", ["-timestamp"])
        additional_query = request.GET.get("query")

        update_snuba_params_with_timestamp(request, snuba_params)

        def data_fn(offset: int, limit: int) -> EventsResponse:
            with handle_query_errors():
                return self.query_logs_data(
                    snuba_params, trace_ids, orderby, additional_query, offset, limit
                )

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            max_per_page=1000,
        )
