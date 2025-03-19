from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Any, TypedDict

import sentry_sdk
from django.http import HttpRequest, HttpResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import handle_query_errors, update_snuba_params_with_timestamp
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.organizations.services.organization import RpcOrganization
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.types import QueryBuilderConfig, SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import run_trace_query

# 1 worker each for spans, errors, performance issues
_query_thread_pool = ThreadPoolExecutor(max_workers=3)


class SerializedEvent(TypedDict):
    description: str
    event_id: str
    event_type: str
    project_id: int
    project_slug: str
    start_timestamp: datetime
    transaction: str


class SerializedSpan(SerializedEvent):
    children: list["SerializedEvent"]
    errors: list["SerializedEvent"]
    duration: float
    end_timestamp: datetime
    op: str
    parent_span_id: str | None
    is_transaction: bool


@region_silo_endpoint
class OrganizationTraceEndpoint(OrganizationEventsV2EndpointBase):
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

    def serialize_rpc_event(self, event: dict[str, Any]) -> SerializedEvent:
        if event.get("event_type") == "error":
            return SerializedEvent(
                event_id=event["id"],
                project_id=event["project.id"],
                project_slug=event["project.name"],
                start_timestamp=event["timestamp"],
                transaction=event["transaction"],
                description=event["message"],
                event_type="error",
            )
        elif event.get("event_type") == "span":
            return SerializedSpan(
                children=[self.serialize_rpc_event(child) for child in event["children"]],
                errors=[self.serialize_rpc_event(error) for error in event["errors"]],
                event_id=event["id"],
                project_id=event["project.id"],
                project_slug=event["project.slug"],
                parent_span_id=None if event["parent_span"] == "0" * 16 else event["parent_span"],
                start_timestamp=event["precise.start_ts"],
                end_timestamp=event["precise.finish_ts"],
                duration=event["span.duration"],
                transaction=event["transaction"],
                is_transaction=event["is_transaction"],
                description=event["description"],
                op=event["span.op"],
                event_type="span",
            )
        else:
            raise Exception(f"Unknown event encountered in trace: {event.get('event_type')}")

    def run_errors_query(self, snuba_params: SnubaParams, trace_id: str):
        """Run an error query, getting all the errors for a given trace id"""
        # TODO: replace this with EAP calls, this query is copied from the old trace view
        error_query = DiscoverQueryBuilder(
            Dataset.Events,
            params={},
            snuba_params=snuba_params,
            query=f"trace:{trace_id}",
            selected_columns=[
                "id",
                "project.name",
                "project.id",
                "timestamp",
                "trace.span",
                "transaction",
                "issue",
                "title",
                "message",
                "tags[level]",
            ],
            # Don't add timestamp to this orderby as snuba will have to split the time range up and make multiple queries
            orderby=["id"],
            limit=10_000,
            config=QueryBuilderConfig(
                auto_fields=True,
            ),
        )
        result = error_query.run_query(Referrer.API_TRACE_VIEW_GET_EVENTS.value)
        error_data = error_query.process_results(result)["data"]
        for event in error_data:
            event["event_type"] = "error"
        return error_data

    @sentry_sdk.tracing.trace
    def query_trace_data(self, snuba_params: SnubaParams, trace_id: str) -> list[SerializedEvent]:
        """Queries span/error data for a given trace"""
        # This is a hack, long term EAP will store both errors and performance_issues eventually but is not ready
        # currently. But we want to move performance data off the old tables immediately. To keep the code simpler I'm
        # parallelizing the queries here, but ideally this parallelization lives in the spans_rpc module instead
        spans_future = _query_thread_pool.submit(
            run_trace_query,
            trace_id,
            snuba_params,
            Referrer.API_TRACE_VIEW_GET_EVENTS.value,
            SearchResolverConfig(),
        )
        errors_future = _query_thread_pool.submit(self.run_errors_query, snuba_params, trace_id)
        spans_data = spans_future.result()
        errors_data = errors_future.result()

        result = []
        id_to_span = {event["id"]: event for event in spans_data}
        id_to_error = {event["trace.span"]: event for event in errors_data}
        for span in spans_data:
            if span["parent_span"] in id_to_span:
                parent = id_to_span[span["parent_span"]]
                parent["children"].append(span)
            else:
                result.append(span)
            if span["id"] in id_to_error:
                error = id_to_error.pop(span["id"])
                span["errors"].append(error)
        for error in id_to_error.values():
            result.append(error)
        return [self.serialize_rpc_event(root) for root in result]

    def has_feature(self, organization: Organization, request: Request) -> bool:
        return bool(
            features.has("organizations:trace-spans-format", organization, actor=request.user)
        )

    def get(self, request: Request, organization: Organization, trace_id: str) -> HttpResponse:
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            # The trace view isn't useful without global views, so skipping the check here
            snuba_params = self.get_snuba_params(request, organization, check_global_views=False)
        except NoProjects:
            return Response(status=404)

        update_snuba_params_with_timestamp(request, snuba_params)

        def data_fn(offset: int, limit: int) -> list[SerializedEvent]:
            """offset and limit don't mean anything on this endpoint currently"""
            with handle_query_errors():
                spans = self.query_trace_data(snuba_params, trace_id)
            return spans

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
        )
