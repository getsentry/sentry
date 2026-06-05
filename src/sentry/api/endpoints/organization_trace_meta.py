import logging

import sentry_sdk
from django.http import HttpResponse
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import TraceItemTableResponse

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.endpoints.organization_events_trace import count_performance_issues
from sentry.api.endpoints.organization_trace_meta_types import OrganizationTraceMetaResponse
from sentry.api.utils import handle_query_errors, update_snuba_params_with_timestamp
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.trace_examples import TraceExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.organizations.services.organization import RpcOrganization
from sentry.search.eap.occurrences.common_queries import count_occurrences_grouped_by_trace_ids
from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator
from sentry.search.eap.types import EAPResponse, SearchResolverConfig
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.types import SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.occurrences_rpc import OccurrenceCategory
from sentry.snuba.ourlogs import OurLogs
from sentry.snuba.referrer import Referrer
from sentry.snuba.rpc_dataset_common import RPCBase, TableQuery
from sentry.snuba.spans_rpc import Spans
from sentry.snuba.trace import _run_uptime_results_query, _uptime_results_query
from sentry.snuba.trace_metrics import TraceMetrics
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor

logger = logging.getLogger(__name__)

TRACE_ID_PATH_PARAM = OpenApiParameter(
    name="trace_id",
    location="path",
    required=True,
    type=str,
    description="The ID of the trace, a 32-character hexadecimal string.",
)

INCLUDE_UPTIME_PARAM = OpenApiParameter(
    name="include_uptime",
    location="query",
    required=False,
    type=str,
    enum=["0", "1"],
    description="Set to `1` to include uptime check counts in the response. Defaults to `0` (disabled).",
)


def extract_uptime_count(uptime_result: list[TraceItemTableResponse]) -> int:
    """Safely extract uptime count from query result."""
    if not uptime_result:
        return 0

    first_result = uptime_result[0]
    if not first_result.column_values:
        return 0

    first_column = first_result.column_values[0]
    return len(first_column.results) if first_column.results else 0


def run_errors_query(trace_id: str, snuba_params: SnubaParams) -> int:
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
    errors = errors_query.run_query(Referrer.API_TRACE_VIEW_GET_EVENTS.value)
    snuba_count = int(errors["data"][0].get("errors", 0)) if errors.get("data") else 0
    errors_count = snuba_count

    callsite = "api.trace.count_errors"
    if EAPOccurrencesComparator.should_check_experiment(callsite):
        eap_count = count_occurrences_grouped_by_trace_ids(
            snuba_params=snuba_params,
            trace_ids=[trace_id],
            referrer=Referrer.API_TRACE_VIEW_GET_EVENTS.value,
            occurrence_category=OccurrenceCategory.ERROR,
        ).get(trace_id, 0)
        errors_count = EAPOccurrencesComparator.check_and_choose(
            snuba_count,
            eap_count,
            callsite,
            is_experimental_data_nullish=(eap_count == 0),
            reasonable_match_comparator=lambda snuba, eap: eap <= snuba,
            debug_context={
                "trace_id": trace_id,
                "organization_id": (
                    snuba_params.organization.id if snuba_params.organization is not None else None
                ),
                "project_ids": [project.id for project in snuba_params.projects],
                "start": snuba_params.start.isoformat() if snuba_params.start else None,
                "end": snuba_params.end.isoformat() if snuba_params.end else None,
            },
        )

    return errors_count


@extend_schema(tags=["Discover"])
@cell_silo_endpoint
class OrganizationTraceMetaEndpoint(OrganizationEventsEndpointBase):
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

    def query_meta_data(
        self,
        trace_id: str,
        snuba_params: SnubaParams,
    ) -> dict[str, EAPResponse]:
        config = SearchResolverConfig(disable_aggregate_extrapolation=True)
        spans_resolver = Spans.get_resolver(snuba_params, config)
        logs_resolver = OurLogs.get_resolver(snuba_params, config)
        trace_metrics_resolver = TraceMetrics.get_resolver(snuba_params, config)
        return RPCBase.run_bulk_table_queries(
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
                TableQuery(
                    query_string=f"trace:{trace_id}",
                    selected_columns=[
                        "count(value)",
                    ],
                    orderby=None,
                    offset=0,
                    limit=1,
                    referrer=Referrer.API_TRACE_VIEW_TRACE_METRICS_META.value,
                    sampling_mode=None,
                    resolver=trace_metrics_resolver,
                    name="metrics_meta",
                ),
            ]
        )

    @extend_schema(
        operation_id="Retrieve Trace Metadata",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            TRACE_ID_PATH_PARAM,
            GlobalParams.STATS_PERIOD,
            GlobalParams.START,
            GlobalParams.END,
            INCLUDE_UPTIME_PARAM,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationTraceMetaResponse", OrganizationTraceMetaResponse
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=TraceExamples.TRACE_META,
    )
    def get(self, request: Request, organization: Organization, trace_id: str) -> HttpResponse:
        """
        Retrieve aggregate metadata for a single trace, including counts of spans,
        errors, performance issues, logs, and metrics, along with per-span-operation
        and per-transaction child-count breakdowns.
        """
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        with handle_query_errors():
            update_snuba_params_with_timestamp(request, snuba_params)

            # This is a hack, long term EAP will store both errors and performance_issues eventually but is not ready
            # currently. But we want to move performance data off the old tables immediately. To keep the code simpler I'm
            # parallelizing the queries here, but ideally this parallelization happens by calling run_bulk_table_queries
            include_uptime = request.GET.get("include_uptime", "0") == "1"
            max_workers = 3 + (1 if include_uptime else 0)
            with ContextPropagatingThreadPoolExecutor(
                thread_name_prefix=__name__,
                max_workers=max_workers,
            ) as query_thread_pool:
                meta_future = query_thread_pool.submit(self.query_meta_data, trace_id, snuba_params)
                perf_issues_future = query_thread_pool.submit(
                    count_performance_issues, trace_id, snuba_params
                )
                errors_future = query_thread_pool.submit(run_errors_query, trace_id, snuba_params)

                uptime_future = None
                if include_uptime:
                    uptime_query = _uptime_results_query(snuba_params, trace_id)
                    uptime_future = query_thread_pool.submit(
                        _run_uptime_results_query, uptime_query
                    )

            results = meta_future.result()
            perf_issues = perf_issues_future.result()
            errors_count = errors_future.result()

            uptime_count = None
            if uptime_future:
                try:
                    uptime_result = uptime_future.result()
                    uptime_count = extract_uptime_count(uptime_result)
                except Exception:
                    logger.exception("Failed to fetch uptime results")
        return Response(self.serialize(results, errors_count, perf_issues, uptime_count))

    def serialize(
        self,
        results: dict[str, EAPResponse],
        errors_count: int,
        perf_issues: int,
        uptime_count: int | None = None,
    ) -> OrganizationTraceMetaResponse:
        # Values can be null if there's no result
        response: OrganizationTraceMetaResponse = {
            "errorsCount": errors_count,
            "logsCount": results["logs_meta"]["data"][0].get("count()") or 0,
            "metricsCount": results["metrics_meta"]["data"][0].get("count(value)") or 0,
            "performanceIssuesCount": perf_issues,
            "spansCount": results["spans_meta"]["data"][0].get("count()") or 0,
            "transactionChildCountMap": results["transaction_children"]["data"],
            "spansCountMap": {
                row["span.op"]: row["count()"] for row in results["spans_op_count"]["data"]
            },
        }

        sentry_sdk.metrics.distribution(
            "performance.trace.logs.count",
            response["logsCount"],
        )
        sentry_sdk.metrics.distribution(
            "performance.trace.span.count",
            response["spansCount"],
        )
        sentry_sdk.metrics.distribution(
            "performance.trace.errors.count",
            response["errorsCount"],
        )

        if uptime_count is not None:
            response["uptimeCount"] = uptime_count
        return response
