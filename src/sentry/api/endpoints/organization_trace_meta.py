from concurrent.futures import ThreadPoolExecutor
from typing import TypedDict

from django.http import HttpRequest, HttpResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.endpoints.organization_events_trace import count_performance_issues
from sentry.api.utils import update_snuba_params_with_timestamp
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.organizations.services.organization import RpcOrganization
from sentry.search.eap.types import EAPResponse, SearchResolverConfig
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.types import SnubaData, SnubaParams
from sentry.snuba import ourlogs, spans_rpc
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.snuba.rpc_dataset_common import TableQuery, run_bulk_table_queries

# 1 worker for each query
_query_thread_pool = ThreadPoolExecutor(max_workers=3)


class SerializedResponse(TypedDict):
    logs: int
    errors: int
    performance_issues: int
    span_count: int
    transaction_child_count_map: SnubaData
    span_count_map: dict[str, int]


@region_silo_endpoint
class OrganizationTraceMetaEndpoint(OrganizationEventsV2EndpointBase):
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

    def query_span_data(
        self,
        trace_id: str,
        snuba_params: SnubaParams,
    ) -> dict[str, EAPResponse]:
        config = SearchResolverConfig(disable_aggregate_extrapolation=True)
        spans_resolver = spans_rpc.get_resolver(snuba_params, config)
        logs_resolver = ourlogs.get_resolver(snuba_params, config)
        return run_bulk_table_queries(
            [
                TableQuery(
                    query_string=f"trace:{trace_id}",
                    selected_columns=["count()"],
                    orderby=None,
                    offset=0,
                    limit=1,
                    referrer=Referrer.API_TRACE_VIEW_SPAN_META.value,
                    sampling_mode=None,
                    resolver=spans_resolver,
                    name="spans_meta",
                ),
                TableQuery(
                    query_string=f"trace:{trace_id}",
                    selected_columns=[
                        "span.op",
                        "count()",
                    ],
                    orderby=["-count()"],
                    offset=0,
                    limit=10_000,
                    referrer=Referrer.API_TRACE_VIEW_SPAN_OP_META.value,
                    sampling_mode=None,
                    resolver=spans_resolver,
                    name="spans_op_count",
                ),
                TableQuery(
                    query_string=f"trace:{trace_id}",
                    selected_columns=[
                        "transaction.event_id",
                        "count()",
                    ],
                    orderby=["transaction.event_id"],
                    offset=0,
                    limit=10_000,
                    referrer=Referrer.API_TRACE_VIEW_TRANSACTION_CHILDREN.value,
                    sampling_mode=None,
                    resolver=spans_resolver,
                    name="transaction_children",
                ),
                TableQuery(
                    query_string=f"trace:{trace_id}",
                    selected_columns=[
                        "count()",
                    ],
                    orderby=None,
                    offset=0,
                    limit=1,
                    referrer=Referrer.API_TRACE_VIEW_LOGS_META.value,
                    sampling_mode=None,
                    resolver=logs_resolver,
                    name="logs_meta",
                ),
            ]
        )

    def get(self, request: Request, organization: Organization, trace_id: str) -> HttpResponse:
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            # The trace meta isn't useful without global views, so skipping the check here
            snuba_params = self.get_snuba_params(request, organization, check_global_views=False)
        except NoProjects:
            return Response(status=404)

        update_snuba_params_with_timestamp(request, snuba_params)

        # This is a hack, long term EAP will store both errors and performance_issues eventually but is not ready
        # currently. But we want to move performance data off the old tables immediately. To keep the code simpler I'm
        # parallelizing the queries here, but ideally this parallelization happens by calling run_bulk_table_queries
        errors_query = DiscoverQueryBuilder(
            dataset=Dataset.Events,
            selected_columns=[
                "count_if(event.type, notEquals, transaction) as errors",
            ],
            params={},
            snuba_params=snuba_params,
            query=f"trace:{trace_id}",
            limit=1,
        )
        spans_future = _query_thread_pool.submit(self.query_span_data, trace_id, snuba_params)
        perf_issues_future = _query_thread_pool.submit(
            count_performance_issues, trace_id, snuba_params
        )
        errors_future = _query_thread_pool.submit(
            errors_query.run_query, Referrer.API_TRACE_VIEW_GET_EVENTS.value
        )

        results = spans_future.result()
        perf_issues = perf_issues_future.result()
        errors = errors_future.result()
        results["errors"] = errors

        return Response(self.serialize(results, perf_issues))

    def serialize(self, results: dict[str, EAPResponse], perf_issues: int) -> SerializedResponse:
        return {
            # Values can be null if there's no result
            "logs": results["logs_meta"]["data"][0].get("count()") or 0,
            "errors": results["errors"]["data"][0].get("errors") or 0,
            "performance_issues": perf_issues,
            "span_count": results["spans_meta"]["data"][0].get("count()") or 0,
            "transaction_child_count_map": results["transaction_children"]["data"],
            "span_count_map": {
                row["span.op"]: row["count()"] for row in results["spans_op_count"]["data"]
            },
        }
