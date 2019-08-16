from __future__ import absolute_import

from rest_framework.response import Response

from sentry.models import Relay
from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import SuperuserPermission


class RelayDetailsEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)

    def delete(self, request, relay_id):
        """
        Delete one Relay
        ````````````````
        :auth: required
        """
        try:
            relay = Relay.objects.get(id=relay_id)
        except Relay.DoesNotExist:
            raise ResourceDoesNotExist

        # TODO(hazat): Create audit entry?

        relay.delete()

        return Response(status=204)
