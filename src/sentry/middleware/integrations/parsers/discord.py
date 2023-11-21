from __future__ import annotations

import logging

import sentry_sdk
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
            integration_id = params.get("integration_id")

            logger.info(
                f"{self.provider}.get_integration_from_request.{self.view_class.__name__}",
                extra={"path": self.request.path, "integration_id": integration_id},
            )
            return Integration.objects.filter(id=integration_id).first()

        if self.view_class == DiscordInteractionsEndpoint:
            drf_request: Request = DiscordInteractionsEndpoint().initialize_request(self.request)
            discord_request: DiscordRequest = self.view_class.discord_request_class(drf_request)

            self.discord_request = discord_request

            with sentry_sdk.push_scope() as scope:
                scope.set_extra("path", self.request.path)
                scope.set_extra("guild_id", discord_request.guild_id)
                sentry_sdk.capture_message(
                    f"{self.provider}.get_integration_from_request.discord_interactions_endpoint"
                )

            return Integration.objects.filter(
                provider=self.provider,
                external_id=discord_request.guild_id,
            ).first()

        logger.info(
            f"{self.provider}.get_integration_from_request.no_view_class",
            extra={"path": self.request.path},
        )

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
