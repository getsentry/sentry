from rest_framework.response import Response

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization_events import OrganizationEventsEndpointBase
from sentry.snuba.metrics_performance import query as metrics_query


@region_silo_endpoint
class OrganizationEventsRootCauseAnalysisEndpoint(OrganizationEventsEndpointBase):
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
        if not transaction_name or not project_id:
            # Project ID is required to ensure the events we query for are
            # the same transaction
            return Response(status=400)

        params = self.get_snuba_params(request, organization)

        # How do we check if 1, this transaction exists, and 2, if it's even a transaction?
        # We can query for the transaction and count the number of events returned.
        # query = f"event.type:transaction transaction:{transaction_name} project:{project_id}"
        transaction_count_query = metrics_query(
            "count()",
            f"event.type:transaction transaction:{transaction_name} project_id:{project_id}",
            params,
        )
        breakpoint()

        return Response(status=200, data=root_cause_results)
