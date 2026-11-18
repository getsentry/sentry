from typing import Annotated, TypedDict

from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.bases.organization import OrganizationAlertRulePermission, OrganizationEndpoint
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.parameters import GlobalParams, OrganizationParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.monitors.models import Monitor
from sentry.utils.auth import AuthenticatedHttpRequest


class MonitorCounts(TypedDict):
    total: Annotated[int, ApiDescription("Cron monitors that match the filters")]
    active: Annotated[int, ApiDescription("Cron monitors that aren't disabled")]
    disabled: Annotated[int, ApiDescription("Cron monitors that are disabled")]


class OrganizationMonitorCountResponse(TypedDict):
    counts: Annotated[MonitorCounts, ApiDescription("Cron monitor counts by status")]


@cell_silo_endpoint
@extend_schema(tags=["Crons"])
class OrganizationMonitorIndexCountEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.CRONS
    permission_classes = (OrganizationAlertRulePermission,)

    @extend_schema(
        operation_id="getOrganizationMonitorCount",
        summary="Count an Organization's Cron Monitors",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            GlobalParams.ENVIRONMENT,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationMonitorCountResponse", OrganizationMonitorCountResponse
            ),
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: AuthenticatedHttpRequest, organization: Organization
    ) -> Response[OrganizationMonitorCountResponse]:
        """
        Return how many cron monitors an organization has, in total and by status. Monitors
        being deleted aren't counted. When filtering by environment, monitors that haven't
        reported from any environment yet are still counted.
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
