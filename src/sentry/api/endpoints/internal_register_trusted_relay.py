from datetime import datetime

from django.utils import timezone
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.serializers.models.organization import TrustedRelaySerializer
from sentry.models import get_org_auth_token_id_from_auth
from sentry.models.options.organization_option import OrganizationOption


@region_silo_endpoint
class InternalRegisterTrustedRelayEndpoint(Endpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.OWNERS_INGEST

    def post(self, request: Request) -> Response:
        """
        Register a new trusted relay for an organization.
        """
        org_auth_token_id = get_org_auth_token_id_from_auth(request.auth)
        organization_id = getattr(request.auth, "organization_id", None)

        # TODO: load organization from the auth token.
        organization = None
        if not features.has("organizations:relay", organization, actor=request.user):
            return Response({"detail": "feature"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = TrustedRelaySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Get existing trusted relays
        option_key = "sentry:trusted-relays"
        try:
            existing = OrganizationOption.objects.get(organization=organization, key=option_key)
            key_dict = {val.get("public_key"): val for val in existing.value}
        except OrganizationOption.DoesNotExist:
            key_dict = {}
            existing = None

        # Format the new relay data
        timestamp_now = datetime.now(timezone.utc).isoformat()
        relay_data = serializer.validated_data.copy()

        # Add timestamps
        relay_data["created"] = timestamp_now
        relay_data["last_modified"] = timestamp_now

        # Update or create the trusted relay entry
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
