from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import SuperuserPermission
from sentry.models.relay import Relay


@region_silo_endpoint
class RelayDetailsEndpoint(Endpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (SuperuserPermission,)
    owner = ApiOwner.OWNERS_INGEST

    def delete(self, request: Request, relay_id) -> Response:
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
