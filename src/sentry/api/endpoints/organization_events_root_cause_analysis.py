from datetime import datetime, timedelta

import sentry_sdk
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

    start = max(datetime.now() - timedelta(days=90), desired_start)
    end = min(desired_end, datetime.now())

    # Keep track of the time period we actually used
    sentry_sdk.set_tag("start_timestamp", start.isoformat())
    sentry_sdk.set_tag("end_timestamp", start.isoformat())

    builder = SpanQueryBuilder(
        dataset=Dataset.Transactions,
        params={**params, "start": start, "end": end},
        selected_columns=["id", "transaction"],
        query="transaction:{transaction}",
        orderby=[],
    )

    snql_query = builder.get_snql_query()
    results = raw_snql_query(snql_query, "api.organization-events-root-cause-analysis")

    breakpoint()
    # TODO: Split the spans into pre and post breakpoint
    return results, results


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

        # TODO: Extract this into a custom serializer to handle validation
        transaction_name = request.GET.get("transaction")
        project_id = request.GET.get("project")
        regression_breakpoint = request.GET.get("breakpoint")
        if not transaction_name or not project_id or not regression_breakpoint:
            # Project ID is required to ensure the events we query for are
            # the same transaction
            return Response(status=400)

        regression_breakpoint = datetime.fromisoformat(regression_breakpoint)
        params = self.get_snuba_params(request, organization)

        if regression_breakpoint > datetime.now():
            return Response(status=400, data="Breakpoint cannot be in the future")

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

        root_cause_results["count_pre_breakpoint_spans"] = len(pre_breakpoint_spans)
        root_cause_results["count_post_breakpoint_spans"] = len(post_breakpoint_spans)
        return Response(status=200, data=root_cause_results)
