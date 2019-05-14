from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.incident import (
    IncidentEndpoint,
    IncidentPermission,
)
from sentry.api.serializers import serialize
from sentry.api.serializers.models.incident import DetailedIncidentSerializer


class OrganizationIncidentDetailsEndpoint(IncidentEndpoint):
    permission_classes = (IncidentPermission, )

    def get(self, request, organization, incident):
        """
        Fetch an Incident.
        ``````````````````
        :auth: required
        """
        data = serialize(incident, request.user, DetailedIncidentSerializer())

        return Response(data)
