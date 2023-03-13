from typing import Tuple

from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.endpoints.notifications.base import BaseNotificationActionsEndpoint
from sentry.models.organization import Organization


@region_silo_endpoint
class NotificationActionsAvailableEndpoint(BaseNotificationActionsEndpoint):
    def get(self, request, organization: Organization, action_trigger: Tuple[int, str]):
        return Response(status=200)

    def post(self, request, organization: Organization, action_trigger: Tuple[int, str]):
        return Response(status=200)
