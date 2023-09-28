from rest_framework.response import Response
from snuba_sdk import Column, Function, LimitBy

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization_events import OrganizationEventsEndpointBase
from sentry.api.endpoints.organization_events_spans_performance import EventID, get_span_description
from sentry.api.helpers.span_analysis import span_analysis
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.types import QueryBuilderConfig
from sentry.search.utils import parse_datetime_string
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics_performance import query as metrics_query
from sentry.utils.snuba import raw_snql_query

DEFAULT_LIMIT = 50
SNUBA_QUERY_LIMIT = 10000


def query_spans(transaction, regression_breakpoint, params):
    selected_columns = [
        "count(span_id) as span_count",
        "sumArray(spans_exclusive_time) as total_span_self_time",
        "array_join(spans_op) as span_op",
        "array_join(spans_group) as span_group",
        # want a single event id to fetch from nodestore for the span description
        "any(id) as sample_event_id",
    ]

    builder = QueryBuilder(
        dataset=Dataset.Discover,
        params=params,
        selected_columns=selected_columns,
        equations=[],
        query=f"transaction:{transaction}",
        orderby=["span_op", "span_group", "total_span_self_time"],
        limit=SNUBA_QUERY_LIMIT,
        config=QueryBuilderConfig(
            auto_aggregations=True,
            use_aggregate_conditions=True,
            functions_acl=[
                "array_join",
                "sumArray",
                "percentileArray",
            ],
        ),
    )

    builder.columns.append(
        Function(
            "if",
            [
                Function("greaterOrEquals", [Column("timestamp"), regression_breakpoint]),
                "after",
                "before",
            ],
            "period",
        )
    )
    builder.columns.append(Function("countDistinct", [Column("event_id")], "transaction_count"))
    builder.groupby.append(Column("period"))
    builder.limitby = LimitBy([Column("period")], SNUBA_QUERY_LIMIT // 2)

    snql_query = builder.get_snql_query()
    results = raw_snql_query(snql_query, "api.organization-events-root-cause-analysis")

    return results.get("data", [])


@region_silo_endpoint
class OrganizationEventsRootCauseAnalysisEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request, organization):
        if not features.has(
            "organizations:performance-duration-regression-visible",
            organization,
            actor=request.user,
        ):
            return Response(status=404)

        # TODO: Extract this into a custom serializer to handle validation
        transaction_name = request.GET.get("transaction")
        project_id = request.GET.get("project")
        regression_breakpoint = request.GET.get("breakpoint")
        if not transaction_name or not project_id or not regression_breakpoint:
            # Project ID is required to ensure the events we query for are
            # the same transaction
            return Response(status=400)

        regression_breakpoint = parse_datetime_string(regression_breakpoint)

        params = self.get_snuba_params(request, organization)

        with self.handle_query_errors():
            transaction_count_query = metrics_query(
                ["count()"],
                f"event.type:transaction transaction:{transaction_name} project_id:{project_id}",
                params,
                referrer="api.organization-events-root-cause-analysis",
            )

        if transaction_count_query["data"][0]["count"] == 0:
            return Response(status=400, data="Transaction not found")

        span_data = query_spans(
            transaction=transaction_name,
            regression_breakpoint=regression_breakpoint,
            params=params,
        )

        span_analysis_results = span_analysis(span_data)

        for result in span_analysis_results:
            result["span_description"] = get_span_description(
                EventID(project_id, result["sample_event_id"]),
                result["span_op"],
                result["span_group"],
            )

        limit = int(request.GET.get("per_page", DEFAULT_LIMIT))
        return Response(span_analysis_results[:limit], status=200)
