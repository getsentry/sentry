from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.bases.organization import OrganizationAlertRulePermission, OrganizationEndpoint
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.monitors.models import Monitor
from sentry.utils.auth import AuthenticatedHttpRequest


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class OrganizationMonitorIndexCountEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.CRONS
    permission_classes = (OrganizationAlertRulePermission,)

    def get(self, request: AuthenticatedHttpRequest, organization: Organization) -> Response:
        """
        Retrieves the count of cron monitors for an organization.
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

        queryset = Monitor.objects.filter(
            organization_id=organization.id, project_id__in=filter_params["project_id"]
        ).exclude(
            status__in=[
                ObjectStatus.PENDING_DELETION,
                ObjectStatus.DELETION_IN_PROGRESS,
            ]
        )

        environments = filter_params.get("environment_objects")
        if environments is not None:
            environment_ids = [e.id for e in environments]
            # use a distinct() filter as queries spanning multiple tables can include duplicates
            queryset = queryset.filter(
                Q(monitorenvironment__environment_id__in=environment_ids)
                | Q(monitorenvironment=None)
            ).distinct()

        all_monitors_count = queryset.count()
        disabled_monitors_count = queryset.filter(status=ObjectStatus.DISABLED).count()
        active_monitors_count = all_monitors_count - disabled_monitors_count

        return self.respond(
            {
                "counts": {
                    "total": all_monitors_count,
                    "active": active_monitors_count,
                    "disabled": disabled_monitors_count,
                },
            }
        )
