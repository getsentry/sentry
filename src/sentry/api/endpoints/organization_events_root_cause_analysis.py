from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization_events import OrganizationEventsEndpointBase
from sentry.snuba.metrics_performance import query as metrics_query


def query_spans(transaction: str, breakpoint):
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
        breakpoint = request.GET.get("breakpoint")
        if not transaction_name or not project_id or not breakpoint:
            # Project ID is required to ensure the events we query for are
            # the same transaction
            return Response(status=400)

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
            transaction=transaction_name, breakpoint=breakpoint
        )

        # TODO: This is only a temporary stub for surfacing RCA data
        root_cause_results["transaction_count"] = transaction_count_query["data"][0]["count"]
        return Response(status=200, data=root_cause_results)
