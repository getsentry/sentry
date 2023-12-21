from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_relay.auth import validate_register_response
from sentry_relay.exceptions import UnpackErrorSignatureExpired

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import is_internal_relay, relay_from_id
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.endpoints.relay.constants import RELAY_AUTH_RATE_LIMITS
from sentry.api.serializers import serialize
from sentry.models.relay import Relay, RelayUsage
from sentry.relay.utils import get_header_relay_id, get_header_relay_signature
from sentry.utils import json

from . import RelayIdSerializer


class RelayRegisterResponseSerializer(RelayIdSerializer):
    token = serializers.CharField(required=True)


@region_silo_endpoint
class RelayRegisterResponseEndpoint(Endpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.OWNERS_INGEST
    authentication_classes = ()
    permission_classes = ()

    enforce_rate_limit = True
    rate_limits = RELAY_AUTH_RATE_LIMITS

    def post(self, request: Request) -> Response:
        """
        Registers a Relay
        `````````````````

        Registers the relay with the sentry installation.  If a relay boots
        it will always attempt to invoke this endpoint.
        """

        try:
            json_data = json.loads(request.body)
        except ValueError:
            return Response({"detail": "No valid json body"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = RelayRegisterResponseSerializer(data=json_data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        sig = get_header_relay_signature(request)
        if not sig:
            return Response(
                {"detail": "Missing relay signature"}, status=status.HTTP_400_BAD_REQUEST
            )

        secret = options.get("system.secret-key")

        try:
            validated = validate_register_response(request.body, sig, secret)
        except UnpackErrorSignatureExpired:
            return Response({"detail": "Challenge expired"}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as exc:
            return Response(
                {"detail": str(exc).splitlines()[0]}, status=status.HTTP_400_BAD_REQUEST
            )

        relay_id = str(validated["relay_id"])
        version = str(validated["version"])
        public_key = validated["public_key"]

        if relay_id != get_header_relay_id(request):
            return Response(
                {"detail": "relay_id in payload did not match header"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        relay, static = relay_from_id(request, relay_id)

        if not static:
            is_internal = is_internal_relay(request, public_key)

            if relay is None:
                relay = Relay.objects.create(
                    relay_id=relay_id, public_key=public_key, is_internal=is_internal
                )
            else:
                # update the internal flag in case it is changed
                relay.is_internal = is_internal
                relay.save()

            # only update usage for non static relays (static relays should not access the db)
            try:
                relay_usage = RelayUsage.objects.get(relay_id=relay_id, version=version)
            except RelayUsage.DoesNotExist:
                RelayUsage.objects.create(relay_id=relay_id, version=version, public_key=public_key)
            else:
                relay_usage.last_seen = timezone.now()
                relay_usage.public_key = public_key
                relay_usage.save()

        assert relay is not None
        return Response(serialize({"relay_id": relay.relay_id}))
