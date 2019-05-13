from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.permissions import RelayPermission
from sentry.api.authentication import RelayAuthentication
from sentry.models import Relay


class RelayPublicKeysEndpoint(Endpoint):
    authentication_classes = (RelayAuthentication,)
    permission_classes = (RelayPermission,)

    def post(self, request):
        relay_ids = request.relay_request_data.get("relay_ids") or ()
        rv = dict.fromkeys(relay_ids)

        if relay_ids:
            relays = Relay.objects.filter(relay_id__in=relay_ids)
            for relay in relays:
                rv[relay.relay_id] = relay.public_key

        return Response({"public_keys": rv}, status=200)
