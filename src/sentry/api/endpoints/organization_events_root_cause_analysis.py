from rest_framework.response import Response

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint


@region_silo_endpoint
class OrganizationEventsRootCauseAnalysisEndpoint(OrganizationEndpoint):
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

        return Response(status=200, data=root_cause_results)
