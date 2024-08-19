from __future__ import annotations

import logging
from collections.abc import Sequence

import sentry_sdk
from django.http import HttpResponse, JsonResponse
from rest_framework import status
from rest_framework.request import Request

from sentry.hybridcloud.outbox.category import WebhookProviderIdentifier
from sentry.integrations.discord.message_builder.base.flags import EPHEMERAL_FLAG
from sentry.integrations.discord.requests.base import DiscordRequest, DiscordRequestError
from sentry.integrations.discord.views.link_identity import DiscordLinkIdentityView
from sentry.integrations.discord.views.unlink_identity import DiscordUnlinkIdentityView
from sentry.integrations.discord.webhooks.base import DiscordInteractionsEndpoint
from sentry.integrations.discord.webhooks.types import DiscordResponseTypes
from sentry.integrations.middleware.hybrid_cloud.parser import (
    BaseRequestParser,
    create_async_request_payload,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.types import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.integrations.web.discord_extension_configuration import (
    DiscordExtensionConfigurationView,
)
from sentry.middleware.integrations.tasks import convert_to_async_discord_response
from sentry.types.region import Region

logger = logging.getLogger(__name__)


class DiscordRequestParser(BaseRequestParser):
    provider = EXTERNAL_PROVIDERS[ExternalProviders.DISCORD]
    webhook_identifier = WebhookProviderIdentifier.DISCORD

    control_classes = [
        DiscordLinkIdentityView,
        DiscordUnlinkIdentityView,
        DiscordExtensionConfigurationView,
    ]

    # Dynamically set to avoid RawPostDataException from double reads
    _discord_request: DiscordRequest | None = None

    # https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-response-object-interaction-callback-type
    async_response_data = {
        "type": DiscordResponseTypes.DEFERRED_MESSAGE,
        "data": {"flags": EPHEMERAL_FLAG},
    }

    @property
    def discord_request(self) -> DiscordRequest | None:
        if self._discord_request is not None:
            return self._discord_request
        if self.view_class != DiscordInteractionsEndpoint:
            return None
        drf_request: Request = DiscordInteractionsEndpoint().initialize_request(self.request)
        self._discord_request: DiscordRequest = self.view_class.discord_request_class(drf_request)
        return self._discord_request

    def get_async_region_response(self, regions: Sequence[Region]) -> HttpResponse:
        if self.discord_request:
            convert_to_async_discord_response.apply_async(
                kwargs={
                    "region_names": [r.name for r in regions],
                    "payload": create_async_request_payload(self.request),
                    "response_url": self.discord_request.response_url,
                }
            )

        return JsonResponse(data=self.async_response_data, status=status.HTTP_200_OK)

    def get_integration_from_request(self) -> Integration | None:
        if self.view_class in self.control_classes:
            # We don't need to identify an integration since we're handling these on Control
            return None

        discord_request = self.discord_request
        if self.view_class == DiscordInteractionsEndpoint and discord_request:
            if discord_request.guild_id is None:
                return None

            return Integration.objects.filter(
                provider=self.provider,
                external_id=discord_request.guild_id,
            ).first()

        with sentry_sdk.isolation_scope() as scope:
            scope.set_extra("path", self.request.path)
            scope.set_extra("guild_id", str(discord_request.guild_id if discord_request else None))
            sentry_sdk.capture_exception(
                Exception(
                    f"Unexpected view class in {self.provider} request parser: {self.view_class.__name__ if self.view_class else None}"
                )
            )

        logger.info(
            "%s.get_integration_from_request.no_view_class",
            self.provider,
            extra={"path": self.request.path},
        )

        return None

    def get_response(self):
        if self.view_class in self.control_classes:
            return self.get_response_from_control_silo()

        is_discord_interactions_endpoint = self.view_class == DiscordInteractionsEndpoint

        # Handle any Requests that doesn't depend on Integration/Organization prior to fetching the Regions.
        if is_discord_interactions_endpoint and self.discord_request:
            # Discord will do automated, routine security checks against the interactions endpoint, including
            # purposefully sending invalid signatures.
            try:
                self.discord_request.validate()
            except DiscordRequestError:
                return HttpResponse(status=status.HTTP_401_UNAUTHORIZED)
            if self.discord_request.is_ping():
                return DiscordInteractionsEndpoint.respond_ping()

        try:
            regions = self.get_regions_from_organizations()
        except (Integration.DoesNotExist, OrganizationIntegration.DoesNotExist):
            return self.get_default_missing_integration_response()

        if is_discord_interactions_endpoint and self.discord_request:
            if self.discord_request.is_command():
                return (
                    self.get_async_region_response(regions=[regions[0]])
                    if self.discord_request.response_url
                    else self.get_response_from_first_region()
                )

            if self.discord_request.is_message_component():
                return (
                    self.get_async_region_response(regions=regions)
                    if self.discord_request.response_url
                    else self.get_response_from_all_regions()
                )

        return self.get_response_from_control_silo()
