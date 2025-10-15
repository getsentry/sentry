from __future__ import annotations

from typing import Any

from django.core.exceptions import ValidationError
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.integrations.api.bases.organization_integrations import (
    OrganizationIntegrationBaseEndpoint,
)
from sentry.integrations.discord.utils.channel import (
    validate_channel_id as discord_validate_channel_id,
)
from sentry.integrations.discord.utils.channel_from_url import (
    get_channel_id_from_url as discord_get_channel_id_from_url,
)
from sentry.integrations.msteams.utils import find_channel_id as msteams_find_channel_id
from sentry.integrations.slack.utils.channel import get_channel_id
from sentry.integrations.types import IntegrationProviderSlug
from sentry.shared_integrations.exceptions import ApiError


@control_silo_endpoint
class OrganizationIntegrationChannelValidateEndpoint(OrganizationIntegrationBaseEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    class ChannelValidateSerializer(serializers.Serializer):
        channel = serializers.CharField(required=True, allow_blank=False)

    def get(
        self,
        request: Request,
        organization_context: Any,
        integration_id: int,
        **kwargs: Any,
    ) -> Response:
        """Validate whether a channel exists for the given integration."""
        serializer = self.ChannelValidateSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        channel = serializer.validated_data["channel"].strip()
        integration = self.get_integration(organization_context.organization.id, integration_id)

        try:
            provider = integration.provider

            if provider == IntegrationProviderSlug.SLACK.value:
                channel_data = get_channel_id(integration=integration, channel_name=channel)
                if channel_data.channel_id:
                    return Response({"valid": True})
                return Response({"valid": False})

            if provider == IntegrationProviderSlug.MSTEAMS.value:
                channel_id = msteams_find_channel_id(integration=integration, name=channel)
                if channel_id:
                    return Response({"valid": True})
                return Response({"valid": False})

            if provider == IntegrationProviderSlug.DISCORD.value:
                try:
                    channel_id = (
                        channel if channel.isdigit() else discord_get_channel_id_from_url(channel)
                    )
                except ValidationError:
                    return Response({"valid": False})

                try:
                    discord_validate_channel_id(
                        channel_id=channel_id,
                        guild_id=str(integration.external_id),
                        guild_name=integration.name,
                    )
                except (ValidationError, ApiError) as e:
                    return Response(
                        {"valid": False, "detail": str(e) or "Discord channel validation failed"}
                    )

                return Response({"valid": True})

            return Response(
                {"valid": False, "detail": "Unsupported provider"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response(
                {"valid": False, "detail": str(e) or "Unexpected error"},
                status=status.HTTP_400_BAD_REQUEST,
            )
