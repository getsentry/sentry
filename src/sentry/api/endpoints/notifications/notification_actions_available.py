from collections import defaultdict

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization_flag import FlaggedOrganizationEndpoint
from sentry.models.notificationaction import NotificationAction
from sentry.models.organization import Organization

# from sentry.services.hybrid_cloud.integration import integration_service


@region_silo_endpoint
class NotificationActionsAvailableEndpoint(FlaggedOrganizationEndpoint):
    feature_flags = ["organizations:notification-actions"]

    def get(self, request: Request, organization: Organization) -> Response:
        payload = defaultdict(list)
        # integrations = integration_service.get_integrations(organization_id=organization.id)
        for _, trigger_text in NotificationAction.get_trigger_types():
            payload[trigger_text].append({})

        return Response(payload)
