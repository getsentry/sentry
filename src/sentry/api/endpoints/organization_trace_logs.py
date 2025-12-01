import sentry_sdk
from django.http import HttpRequest, HttpResponse
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import handle_query_errors, update_snuba_params_with_timestamp
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.organizations.services.organization import RpcOrganization
from sentry.search.eap import constants
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import EventsResponse, SnubaParams
from sentry.snuba.ourlogs import OurLogs
from sentry.snuba.referrer import Referrer
from sentry.utils.validators import INVALID_ID_DETAILS, is_event_id


@region_silo_endpoint
class OrganizationTraceLogsEndpoint(OrganizationEventsEndpointBase):
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
        replay_id: str | None,
        orderby: list[str],
        additional_query: str | None,
        offset: int,
        limit: int,
    ) -> EventsResponse:
        """Queries log data for a given trace"""

        required_keys = [
            "id",
            "project.id",
            constants.TRACE_ALIAS,
            "severity_number",
            "severity",
            constants.TIMESTAMP_ALIAS,
            constants.TIMESTAMP_PRECISE_ALIAS,
            "message",
        ]
        # Validate that orderby values are also in required_keys
        for column in orderby:
            stripped_orderby = column.lstrip("-")
            if stripped_orderby not in required_keys:
                raise ParseError(
                    f"{stripped_orderby} must be one of {','.join(sorted(required_keys))}"
                )

        base_query_parts = []

        # Create the query based on trace id and/or replay id
        if trace_ids:
            trace_query = (
                f"{constants.TRACE_ALIAS}:{trace_ids[0]}"
                if len(trace_ids) == 1
                else f"{constants.TRACE_ALIAS}:[{','.join(trace_ids)}]"
            )
            base_query_parts.append(trace_query)

        if replay_id:
            replay_query = f"replay_id:{replay_id}"
            base_query_parts.append(replay_query)

        if len(base_query_parts) > 1:
            base_query = f"({' OR '.join(base_query_parts)})"
        else:
            base_query = base_query_parts[0]

        if additional_query is not None:
            query = f"{base_query} and {additional_query}"
        else:
            query = base_query

        results = OurLogs.run_table_query(
            params=snuba_params,
            query_string=query,
            selected_columns=required_keys,
            orderby=orderby,
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
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        trace_ids = request.GET.getlist("traceId", [])
        replay_id = request.GET.get("replayId")

        for trace_id in trace_ids:
            if not is_event_id(trace_id):
                raise ParseError(INVALID_ID_DETAILS.format(trace_id))

        if replay_id and not is_event_id(replay_id):
            raise ParseError(INVALID_ID_DETAILS.format(replay_id))

        if len(trace_ids) == 0 and not replay_id:
            raise ParseError("Need to pass at least one traceId or replayId")

        orderby = request.GET.getlist("sort", ["-timestamp", "-timestamp_precise"])
        additional_query = request.GET.get("query")

        update_snuba_params_with_timestamp(request, snuba_params)

        def data_fn(offset: int, limit: int) -> EventsResponse:
            with handle_query_errors():
                return self.query_logs_data(
                    snuba_params, trace_ids, replay_id, orderby, additional_query, offset, limit
                )

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            max_per_page=9999,
        )
