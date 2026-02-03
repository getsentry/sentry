from drf_spectacular.utils import extend_schema
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.uptime.types import GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE
from sentry.utils.auth import AuthenticatedHttpRequest
from sentry.workflow_engine.models import Detector


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

        queryset = Detector.objects.with_type_filters().filter(
            status=ObjectStatus.ACTIVE,
            type=GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE,
            project__organization_id=organization.id,
            project_id__in=filter_params["project_id"],
        )

        if "environment" in filter_params:
            queryset = queryset.filter(config__environment__in=filter_params["environment"])

        enabled_uptime_alerts_count = queryset.filter(enabled=True).count()
        disabled_uptime_alerts_count = queryset.filter(enabled=False).count()

        return self.respond(
            {
                "counts": {
                    "total": enabled_uptime_alerts_count + disabled_uptime_alerts_count,
                    "active": enabled_uptime_alerts_count,
                    "disabled": disabled_uptime_alerts_count,
                },
            }
        )
