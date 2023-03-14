from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization_flag import FlaggedOrganizationEndpoint
from sentry.models.organization import Organization


@region_silo_endpoint
class NotificationActionsAvailableEndpoint(FlaggedOrganizationEndpoint):
    feature_flags = ["organizations:notification-actions"]

    def get(self, request: Request, organization: Organization) -> Response:
        return Response({})
