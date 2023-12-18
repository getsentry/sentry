from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.incident import IncidentEndpoint, IncidentPermission
from sentry.incidents.logic import subscribe_to_incident, unsubscribe_from_incident


class IncidentSubscriptionPermission(IncidentPermission):
    scope_map = IncidentPermission.scope_map.copy()
    scope_map["DELETE"] = [
        "org:write",
        "org:admin",
        "project:read",
        "project:write",
        "project:admin",
    ]


@region_silo_endpoint
class OrganizationIncidentSubscriptionIndexEndpoint(IncidentEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
        "POST": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (IncidentSubscriptionPermission,)

    def post(self, request: Request, organization, incident) -> Response:
        """
        Subscribes the authenticated user to the incident.
        ``````````````````````````````````````````````````
        Subscribes the user to the incident. If they are already subscribed
        then no-op.
        :auth: required
        """

        subscribe_to_incident(incident, request.user.id)
        return Response({}, status=201)

    def delete(self, request: Request, organization, incident) -> Response:
        """
        Unsubscribes the authenticated user from the incident.
        ``````````````````````````````````````````````````````
        Unsubscribes the user from the incident. If they are not subscribed then
        no-op.
        :auth: required
        """
        unsubscribe_from_incident(incident, request.user.id)
        return Response({}, status=200)
