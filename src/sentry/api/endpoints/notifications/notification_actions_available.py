from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.constants import ObjectStatus
from sentry.models.notificationaction import NotificationAction
from sentry.models.organization import Organization
from sentry.services.hybrid_cloud.integration import integration_service


@region_silo_endpoint
class NotificationActionsAvailableEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Responds with a payload serialized directly from running the 'serialize_available' methods
        on the ActionRegistration objects within the NotificationAction registry.
        """
        payload: dict[str, list[dict[str, object]]] = {"actions": []}
        integrations = integration_service.get_integrations(
            organization_id=organization.id,
            status=ObjectStatus.ACTIVE,
            org_integration_status=ObjectStatus.ACTIVE,
        )
        for registration in NotificationAction.get_registry().values():
            serialized_available_actions = registration.serialize_available(
                organization=organization,
                integrations=integrations,
            )
            for action in serialized_available_actions:
                payload["actions"].append(action)

        return Response(payload)
