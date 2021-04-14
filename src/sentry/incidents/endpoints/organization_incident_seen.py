from rest_framework.response import Response

from sentry.api.bases.incident import IncidentEndpoint, IncidentPermission
from sentry.incidents.logic import set_incident_seen


class OrganizationIncidentSeenEndpoint(IncidentEndpoint):
    permission_classes = (IncidentPermission,)

    def post(self, request, organization, incident):
        """
        Mark an incident as seen by the user
        ````````````````````````````````````

        :auth: required
        """

        set_incident_seen(incident=incident, user=request.user)
        return Response({}, status=201)
