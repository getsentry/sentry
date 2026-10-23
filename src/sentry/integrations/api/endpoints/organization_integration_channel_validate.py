from __future__ import annotations

from typing import Any, TypedDict

import sentry_sdk
from django.core.exceptions import ValidationError
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response
from slack_sdk.errors import SlackApiError

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.response_types import ValidationErrorResponse, as_validation_errors
from sentry.apidocs.utils import inline_sentry_response_serializer
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
from sentry.organizations.services.organization import RpcUserOrganizationContext
from sentry.shared_integrations.exceptions import ApiError


class ChannelValidateSerializer(serializers.Serializer):
    channel = serializers.CharField(required=True, allow_blank=False)


class DetailOptionalResponse(TypedDict, total=False):
    """Use a total=False base because postponed NotRequired annotations become required in OpenAPI."""

    detail: str


class IntegrationChannelValidationResponse(DetailOptionalResponse):
    valid: bool


@extend_schema(tags=["Integration"])
@control_silo_endpoint
class OrganizationIntegrationChannelValidateEndpoint(OrganizationIntegrationBaseEndpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC_EXPERIMENTAL}
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    @extend_schema(
        operation_id="validateOrganizationIntegrationChannel",
        summary="Validate a Messaging Channel for an Integration",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.INTEGRATION_ID,
            ChannelValidateSerializer,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "IntegrationChannelValidationResponse", IntegrationChannelValidationResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        integration_id: int,
        **kwargs: Any,
    ) -> Response[IntegrationChannelValidationResponse] | Response[ValidationErrorResponse]:
        """Validate whether a channel exists for the given integration."""
        serializer = ChannelValidateSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=status.HTTP_400_BAD_REQUEST)

        channel = serializer.validated_data["channel"].strip()
        integration = self.get_integration(organization_context.organization.id, integration_id)

        provider = integration.provider

        try:
            if provider == IntegrationProviderSlug.SLACK.value:
                channel_data = get_channel_id(integration=integration, channel_name=channel)
                return Response(
                    IntegrationChannelValidationResponse(valid=bool(channel_data.channel_id))
                )

            elif provider == IntegrationProviderSlug.MSTEAMS.value:
                channel_id = msteams_find_channel_id(integration=integration, name=channel)
                return Response(IntegrationChannelValidationResponse(valid=bool(channel_id)))

            elif provider == IntegrationProviderSlug.DISCORD.value:
                channel_id = (
                    channel if channel.isdigit() else discord_get_channel_id_from_url(channel)
                )
                discord_validate_channel_id(
                    channel_id=channel_id,
                    guild_id=str(integration.external_id),
                    guild_name=integration.name,
                )
                return Response(IntegrationChannelValidationResponse(valid=True))

            return Response(
                IntegrationChannelValidationResponse(valid=False, detail="Unsupported provider"),
                status=status.HTTP_400_BAD_REQUEST,
            )

        except (SlackApiError, ApiError, ValidationError):
            return Response(IntegrationChannelValidationResponse(valid=False))
        except Exception as e:
            sentry_sdk.capture_message(f"Unexpected {provider} channel validation error")
            sentry_sdk.capture_exception(e)
            return Response(
                IntegrationChannelValidationResponse(valid=False, detail="Unexpected error")
            )
