from datetime import datetime, timedelta

from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization_events import OrganizationEventsEndpointBase
from sentry.api.endpoints.organization_events_spans_performance import SpanQueryBuilder
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics_performance import query as metrics_query
from sentry.utils.snuba import raw_snql_query


def query_spans(transaction: str, regression_breakpoint, params):
    # Try to center the time period around the breakpoint
    # but also get the most recent data points

    # Should it be consistent or can I have more data included when
    # there are more recent data points?

    # Attempt to get 30 days worth of data split by the breakpoint
    desired_end = regression_breakpoint + timedelta(days=15)
    desired_start = regression_breakpoint - timedelta(days=15)

    # TODO: Monitor this data and see what the activity of the bounds is like
    start = max(datetime.now() - timedelta(days=90), desired_start)
    end = min(desired_end, datetime.now())

    builder = SpanQueryBuilder(
        dataset=Dataset.Discover,
        params={**params, "start": start, "end": end},
        selected_columns=["id", "project.id"],
        query="",
        orderby=[],
    )

    snql_query = builder.get_snql_query()
    results = raw_snql_query(snql_query, "api.organization-events-spans-performance-examples")

    breakpoint()
    return results, results


def serialize_span(span):
    pass


@region_silo_endpoint
class OrganizationEventsRootCauseAnalysisEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request, organization):
        if not features.has(
            "organizations:statistical-detectors-root-cause-analysis",
            organization,
            actor=request.user,
        ):
            return Response(status=404)

        root_cause_results = {}

        transaction_name = request.GET.get("transaction")
        project_id = request.GET.get("project")
        regression_breakpoint = request.GET.get("breakpoint")
        if not transaction_name or not project_id or not regression_breakpoint:
            # Project ID is required to ensure the events we query for are
            # the same transaction
            return Response(status=400)

        regression_breakpoint = datetime.fromisoformat(regression_breakpoint)
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

        pre_breakpoint_spans, post_breakpoint_spans = query_spans(
            transaction=transaction_name, regression_breakpoint=regression_breakpoint, params=params
        )

        # TODO: This is only a temporary stub for surfacing RCA data
        root_cause_results["pre_breakpoint_spans"] = [
            serialize_span(span) for span in pre_breakpoint_spans
        ]
        root_cause_results["post_breakpoint_spans"] = [
            serialize_span(span) for span in post_breakpoint_spans
        ]
        return Response(status=200, data=root_cause_results)
