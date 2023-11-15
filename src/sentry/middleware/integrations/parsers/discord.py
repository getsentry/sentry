from __future__ import annotations

import logging

from rest_framework.request import Request

from sentry.integrations.discord.requests.base import DiscordRequest
from sentry.integrations.discord.views.link_identity import DiscordLinkIdentityView
from sentry.integrations.discord.views.unlink_identity import DiscordUnlinkIdentityView
from sentry.integrations.discord.webhooks.base import DiscordInteractionsEndpoint
from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.models.integrations import Integration
from sentry.models.outbox import WebhookProviderIdentifier
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.utils.signing import unsign

logger = logging.getLogger(__name__)


class DiscordRequestParser(BaseRequestParser):
    provider = EXTERNAL_PROVIDERS[ExternalProviders.DISCORD]
    webhook_identifier = WebhookProviderIdentifier.DISCORD

    control_classes = [
        DiscordLinkIdentityView,
        DiscordUnlinkIdentityView,
    ]

    # Dynamically set to avoid RawPostDataException from double reads
    discord_request: DiscordRequest | None

    def get_integration_from_request(self) -> Integration | None:
        if self.view_class in self.control_classes:
            params = unsign(self.match.kwargs.get("signed_params"))
            return Integration.objects.filter(id=params.get("integration_id")).first()

        if self.view_class == DiscordInteractionsEndpoint:
            drf_request: Request = DiscordInteractionsEndpoint().initialize_request(self.request)
            discord_request: DiscordRequest = self.view_class.discord_request_class(drf_request)

            self.discord_request = discord_request

            return Integration.objects.filter(
                provider=self.provider,
                external_id=discord_request.guild_id,
            ).first()

        return None

    def get_response(self):
        if self.view_class in self.control_classes:
            return self.get_response_from_control_silo()

        regions = self.get_regions_from_organizations()
        if len(regions) == 0:
            logger.info(f"{self.provider}.no_regions", extra={"path": self.request.path})
            return self.get_response_from_control_silo()

        if self.view_class == DiscordInteractionsEndpoint:
            if self.discord_request:
                if self.discord_request.is_command() or self.discord_request.is_ping():
                    return self.get_response_from_first_region()

                if self.discord_request.is_message_component():
                    return self.get_response_from_all_regions()

        return self.get_response_from_control_silo()
