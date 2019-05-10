from __future__ import absolute_import

from rest_framework.response import Response

from sentry import features
from sentry.api.bases.incident import IncidentPermission
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.incident import DetailedIncidentSerializer
from sentry.incidents.models import Incident


class OrganizationIncidentDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (IncidentPermission, )

    def convert_args(self, request, incident_id, *args, **kwargs):
        args, kwargs = super(OrganizationIncidentDetailsEndpoint, self).convert_args(
            request,
            *args,
            **kwargs
        )
        organization = kwargs['organization']

        if not features.has('organizations:incidents', organization, actor=request.user):
            raise ResourceDoesNotExist

        try:
            kwargs['incident'] = Incident.objects.get(
                organization=organization,
                id=incident_id,
            )
        except Incident.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs

    def get(self, request, organization, incident):
        """
        Fetch an Incident.
        ``````````````````
        :auth: required
        """
        data = serialize(incident, request.user, DetailedIncidentSerializer())

        return Response(data)
