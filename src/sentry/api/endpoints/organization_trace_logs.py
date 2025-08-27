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
from sentry.search.eap import constants
from sentry.search.eap.ourlogs.attributes import ourlog_attribute_map
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import EventsResponse, SnubaParams
from sentry.snuba.ourlogs import OurLogs
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

        attribute_mapping = ourlog_attribute_map()

        timestamp_precise_column = "timestamp_precise"

        selected_columns = [
            "id",
            "project.id",
            "trace",
            "severity_number",
            "severity",
            "timestamp",
            timestamp_precise_column,
            "message",
        ]

        for key in selected_columns:
            attr = attribute_mapping.get(key)
            if attr is None:
                raise ValueError(f"Required attribute '{key}' not found in attribute mapping")

        converted_orderby = []
        for column in orderby:
            prefix = "-" if column.startswith("-") else ""
            directionless_column = column.lstrip("-")
            if directionless_column not in selected_columns:
                raise ParseError(
                    f"{directionless_column} must be one of {','.join(sorted(selected_columns))}"
                )
            attr = attribute_mapping.get(directionless_column)
            if attr is None:
                raise ParseError(f"Unknown attribute: {directionless_column}")
            converted_orderby.append(f"{prefix}{attr.public_alias}")
            if directionless_column == "timestamp":
                # Timestamp precise must also be added when sorting by timestamp as timestamp since timestamp should have been a DateTime64...
                converted_orderby.append(f"{prefix}{timestamp_precise_column}")

        trace_attr = attribute_mapping.get("trace")
        if trace_attr is None:
            raise ParseError("trace attribute not found")
        trace_alias = trace_attr.public_alias

        base_query = (
            f"{trace_alias}:{trace_ids[0]}"
            if len(trace_ids) == 1
            else f"{trace_alias}:[{','.join(trace_ids)}]"
        )
        if additional_query is not None:
            query = f"{base_query} and {additional_query}"
        else:
            query = base_query
        results = OurLogs.run_table_query(
            params=snuba_params,
            query_string=query,
            selected_columns=selected_columns,
            orderby=converted_orderby,
            offset=offset,
            limit=limit,
            referrer=Referrer.API_TRACE_VIEW_LOGS.value,
            config=SearchResolverConfig(use_aggregate_conditions=False),
            # Since we're getting all logs for a given trace we always want highest accuracy
            sampling_mode=constants.SAMPLING_MODE_HIGHEST_ACCURACY,
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
            max_per_page=9999,
        )
