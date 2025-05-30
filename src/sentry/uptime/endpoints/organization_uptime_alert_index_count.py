from drf_spectacular.utils import extend_schema
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.uptime.models import ProjectUptimeSubscription
from sentry.utils.auth import AuthenticatedHttpRequest


@region_silo_endpoint
@extend_schema(tags=["Uptime Monitors"])
class OrganizationUptimeAlertIndexCountEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.CRONS
    permission_classes = (OrganizationPermission,)

    def get(self, request: AuthenticatedHttpRequest, organization: Organization) -> Response:
        """
        Retrieves the count of uptime monitors for an organization.
        """
        try:
            filter_params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            return self.respond(
                {
                    "counts": {
                        "total": 0,
                        "active": 0,
                        "disabled": 0,
                    },
                }
            )

        queryset = ProjectUptimeSubscription.objects.filter(
            project__organization_id=organization.id, project_id__in=filter_params["project_id"]
        ).exclude(
            status__in=[
                ObjectStatus.PENDING_DELETION,
                ObjectStatus.DELETION_IN_PROGRESS,
            ]
        )

        environments = filter_params.get("environment_objects")
        if environments is not None:
            queryset = queryset.filter(environment__in=environments)

        all_uptime_alerts_count = queryset.count()
        disabled_uptime_alerts_count = queryset.filter(status=ObjectStatus.DISABLED).count()
        active_uptime_alerts_count = all_uptime_alerts_count - disabled_uptime_alerts_count

        return self.respond(
            {
                "counts": {
                    "total": all_uptime_alerts_count,
                    "active": active_uptime_alerts_count,
                    "disabled": disabled_uptime_alerts_count,
                },
            }
        )
