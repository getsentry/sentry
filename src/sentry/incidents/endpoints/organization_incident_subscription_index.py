from rest_framework.response import Response

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


class OrganizationIncidentSubscriptionIndexEndpoint(IncidentEndpoint):
    permission_classes = (IncidentSubscriptionPermission,)

    def post(self, request, organization, incident):
        """
        Subscribes the authenticated user to the incident.
        ``````````````````````````````````````````````````
        Subscribes the user to the incident. If they are already subscribed
        then no-op.
        :auth: required
        """

        subscribe_to_incident(incident, request.user)
        return Response({}, status=201)

    def delete(self, request, organization, incident):
        """
        Unsubscribes the authenticated user from the incident.
        ``````````````````````````````````````````````````````
        Unsubscribes the user from the incident. If they are not subscribed then
        no-op.
        :auth: required
        """
        unsubscribe_from_incident(incident, request.user)
        return Response({}, status=200)
