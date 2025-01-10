from datetime import datetime, timezone

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import UserAuthTokenAuthentication
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers.models.organization import TrustedRelaySerializer
from sentry.models.options.organization_option import OrganizationOption


@region_silo_endpoint
class InternalRegisterTrustedRelayEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.OWNERS_INGEST
    authentication_classes = (UserAuthTokenAuthentication,)

    def post(self, request: Request, organization) -> Response:
        """
        Register a new trusted relay for an organization.
        If a relay with the given public key already exists, update it.
        """
        if not features.has("organizations:relay", organization, actor=request.user):
            return Response(
                {"detail": "The organization is not enabled to use an external Relay."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = TrustedRelaySerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"detail": "Invalid request body"}, status=status.HTTP_400_BAD_REQUEST)

        # Get existing trusted relays
        option_key = "sentry:trusted-relays"
        try:
            existing_option = OrganizationOption.objects.get(
                organization=organization, key=option_key
            )
            existing_relays = existing_option.value
        except OrganizationOption.DoesNotExist:
            existing_option = None
            existing_relays = []

        relay_data = serializer.validated_data.copy()
        public_key = relay_data.get("public_key")
        timestamp_now = datetime.now(timezone.utc).isoformat()

        # Find existing relay with this public key
        existing_relay_index = None
        for index, relay in enumerate(existing_relays):
            if relay.get("public_key") == public_key:
                existing_relay_index = index
                break

        if existing_relay_index is not None:
            # Update existing relay
            relay_data["created"] = existing_relays[existing_relay_index]["created"]
            relay_data["last_modified"] = timestamp_now
            existing_relays[existing_relay_index] = relay_data
        else:
            # Add new relay
            relay_data["created"] = timestamp_now
            relay_data["last_modified"] = timestamp_now
            existing_relays.append(relay_data)

        # Save the updated relay list
        if existing_option is not None:
            existing_option.value = existing_relays
            existing_option.save()
        else:
            OrganizationOption.objects.set_value(
                organization=organization, key=option_key, value=existing_relays
            )

        return Response(relay_data, status=status.HTTP_201_CREATED)
