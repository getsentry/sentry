from datetime import datetime, timezone

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.serializers.models.organization import TrustedRelaySerializer
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organization import Organization


class TrustedRelayPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:write", "org:admin", "org:ci"],
        "PUT": ["org:write", "org:admin"],
        "DELETE": ["org:admin"],
    }


@region_silo_endpoint
class InternalRegisterTrustedRelayEndpoint(Endpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.OWNERS_INGEST
    permission_classes = (TrustedRelayPermission,)

    def post(self, request: Request) -> Response:
        """
        Register a new trusted relay for an organization.
        """
        organization_id = getattr(request.auth, "organization_id", None)
        if not organization_id:
            return Response(
                {"detail": "Organization not found"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            organization = Organization.objects.get(id=organization_id)
        except Organization.DoesNotExist:
            return Response({"detail": "Organization not found"}, status=status.HTTP_404_NOT_FOUND)

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
            existing = OrganizationOption.objects.get(organization=organization, key=option_key)
            existing_public_keys = {val.get("public_key"): val for val in existing.value}
        except OrganizationOption.DoesNotExist:
            existing_public_keys = {}
            existing = None

        timestamp_now = datetime.now(timezone.utc).isoformat()
        relay_data = serializer.validated_data.copy()
        public_key = relay_data.get("public_key")

        # Check if this public key already exists
        if public_key in existing_public_keys:
            return Response(
                {"public_key": "A relay with this public key already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Set timestamps
        relay_data["created"] = timestamp_now
        relay_data["last_modified"] = timestamp_now

        # Create or update the trusted relay entry
        if existing is not None:
            existing_relays = existing.value
            existing_relays.append(relay_data)
            existing.value = existing_relays
            existing.save()
        else:
            OrganizationOption.objects.set_value(
                organization=organization, key=option_key, value=[relay_data]
            )

        return Response(relay_data, status=status.HTTP_201_CREATED)
