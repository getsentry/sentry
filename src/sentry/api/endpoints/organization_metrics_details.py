from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationAndStaffPermission, OrganizationEndpoint
from sentry.models.organization import Organization
from sentry.sentry_metrics.querying.metadata import get_metrics_meta
from sentry.sentry_metrics.use_case_utils import get_use_case_ids


@region_silo_endpoint
class OrganizationMetricsDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    permission_classes = (OrganizationAndStaffPermission,)

    """Get the metadata of all the stored metrics including metric name, available operations and metric unit"""

    def get(self, request: Request, organization: Organization) -> Response:
        projects = self.get_projects(request, organization)
        if not projects:
            return Response(
                {"detail": "You must supply at least one project to see its metrics"}, status=404
            )

        if all(
            features.has("projects:use-eap-spans-for-metrics-explorer", project)
            for project in projects
        ):
            return Response(
                [
                    {
                        "type": "d",
                        "name": "measurement",
                        "unit": "none",
                        "mri": "d:eap/measurement@none",
                        "operations": ["sum", "avg", "p50", "p95", "p99", "count"],
                        "projectIds": [project.id for project in projects],
                        "blockingStatus": [],
                    }
                ]
            )

        metrics = get_metrics_meta(
            organization=organization, projects=projects, use_case_ids=get_use_case_ids(request)
        )

        return Response(metrics, status=200)
