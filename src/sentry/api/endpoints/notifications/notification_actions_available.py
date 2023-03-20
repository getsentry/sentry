from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization_flag import FlaggedOrganizationEndpoint
from sentry.incidents.logic import get_available_action_integrations_for_org
from sentry.models.notificationaction import NotificationAction
from sentry.models.organization import Organization


@region_silo_endpoint
class NotificationActionsAvailableEndpoint(FlaggedOrganizationEndpoint):
    feature_flags = ["organizations:notification-actions"]

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Responds with a payload serialized directly from running the 'descriptor' functions
        in the NotificationAction registry.
        """
        payload = []

        for registration in NotificationAction.get_registry().values():
            serialized_available_actions = registration.serialize_available(
                organization=organization,
                integrations=get_available_action_integrations_for_org(organization),
            )
            for action in serialized_available_actions:
                payload.append(action)

        return Response(payload)
