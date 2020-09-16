from __future__ import absolute_import

import six

from rest_framework.response import Response
from rest_framework import serializers, status

from django.conf import settings
from django.utils import timezone

from sentry import options
from sentry.utils import json
from sentry.models import Relay, RelayUsage
from sentry.auth.system import is_internal_ip
from sentry.api.base import Endpoint
from sentry.api.serializers import serialize
from sentry.relay.utils import get_header_relay_id, get_header_relay_signature

from sentry_relay import (
    create_register_challenge,
    validate_register_response,
    is_version_supported,
    UnpackErrorSignatureExpired,
)


class RelayIdSerializer(serializers.Serializer):
    relay_id = serializers.RegexField(
        r"^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$", required=True
    )


class RelayRegisterChallengeSerializer(RelayIdSerializer):
    public_key = serializers.CharField(max_length=64, required=True)


class RelayRegisterResponseSerializer(RelayIdSerializer):
    token = serializers.CharField(required=True)


def is_internal_relay(request, public_key):
    """
    Checks if the relay is allowed to register, otherwise raises an exception
    """
    if settings.DEBUG or public_key in settings.SENTRY_RELAY_WHITELIST_PK:
        return True

    return is_internal_ip(request)


class RelayRegisterChallengeEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    def post(self, request):
        """
        Requests to Register a Relay
        ````````````````````````````

        Registers the relay with the sentry installation.  If a relay boots
        it will always attempt to invoke this endpoint.
        """
        try:
            json_data = json.loads(request.body)
        except ValueError:
            return Response({"detail": "No valid json body"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = RelayRegisterChallengeSerializer(data=json_data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        if not is_version_supported(json_data.get("version")):
            return Response(
                {
                    "detail": "Relay version no longer supported, please upgrade to a more recent version"
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        public_key = json_data.get("public_key")
        if not public_key:
            return Response({"detail": "Missing public key"}, status=status.HTTP_400_FORBIDDEN)

        if not settings.SENTRY_RELAY_OPEN_REGISTRATION and not is_internal_relay(
            request, public_key
        ):
            return Response(
                {"detail": "Relay is not allowed to register"}, status=status.HTTP_403_FORBIDDEN
            )

        sig = get_header_relay_signature(request)
        if not sig:
            return Response(
                {"detail": "Missing relay signature"}, status=status.HTTP_400_BAD_REQUEST
            )

        secret = options.get("system.secret-key")

        try:
            challenge = create_register_challenge(request.body, sig, secret)
        except Exception as exc:
            return Response(
                {"detail": str(exc).splitlines()[0]}, status=status.HTTP_400_BAD_REQUEST
            )

        relay_id = six.text_type(challenge["relay_id"])
        if relay_id != get_header_relay_id(request):
            return Response(
                {"detail": "relay_id in payload did not match header"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            relay = Relay.objects.get(relay_id=relay_id)
        except Relay.DoesNotExist:
            pass
        else:
            if relay.public_key != six.text_type(public_key):
                # This happens if we have an ID collision or someone copies an existing id
                return Response(
                    {"detail": "Attempted to register agent with a different public key"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        return Response(serialize(challenge))


class RelayRegisterResponseEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    def post(self, request):
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

        relay_id = six.text_type(validated["relay_id"])
        version = six.text_type(validated["version"])
        public_key = validated["public_key"]

        if relay_id != get_header_relay_id(request):
            return Response(
                {"detail": "relay_id in payload did not match header"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_internal = is_internal_relay(request, public_key)
        try:
            relay = Relay.objects.get(relay_id=relay_id)
        except Relay.DoesNotExist:
            relay = Relay.objects.create(
                relay_id=relay_id, public_key=public_key, is_internal=is_internal
            )
        else:
            relay.is_internal = is_internal
            relay.save()

        try:
            relay_usage = RelayUsage.objects.get(relay_id=relay_id, version=version)
        except RelayUsage.DoesNotExist:
            RelayUsage.objects.create(relay_id=relay_id, version=version)
        else:
            relay_usage.last_seen = timezone.now()
            relay_usage.save()

        return Response(serialize({"relay_id": relay.relay_id}))
