from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.authentication import RelayAuthentication
from sentry.api.base import Endpoint
from sentry.api.permissions import RelayPermission
from sentry.models import Relay


class RelayPublicKeysEndpoint(Endpoint):
    authentication_classes = (RelayAuthentication,)
    permission_classes = (RelayPermission,)
    enforce_rate_limit = False

    def post(self, request: Request) -> Response:
        calling_relay = request.relay

        relay_ids = request.relay_request_data.get("relay_ids") or ()
        legacy_public_keys = dict.fromkeys(relay_ids)
        public_keys = dict.fromkeys(relay_ids)

        if relay_ids:
            relays = Relay.objects.filter(relay_id__in=relay_ids)
            for relay in relays:
                pk = relay.public_key
                relay_id = relay.relay_id

                legacy_public_keys[relay_id] = pk
                public_keys[relay_id] = {
                    "publicKey": pk,
                    # only expose internal information to internal relays
                    "internal": relay.is_internal and calling_relay.is_internal,
                }

        return Response({"public_keys": legacy_public_keys, "relays": public_keys}, status=200)
