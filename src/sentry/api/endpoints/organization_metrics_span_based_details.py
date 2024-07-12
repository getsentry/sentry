from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationAndStaffPermission, OrganizationEndpoint


@region_silo_endpoint
class OrganizationMetricsSpanBasedDetails(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    permission_classes = (OrganizationAndStaffPermission,)

    """Get the metadata of all the span-based metrics including metric name, available operations and metric unit"""

    def get(self, request: Request, organization) -> Response:
        projects = self.get_projects(request, organization)
        if not projects:
            return Response(
                {"detail": "You must supply at least one project to see its metrics"}, status=404
            )

        # metrics = get_span_based_metrics_meta(organization=organization, projects=projects)

        return Response(status=200)
