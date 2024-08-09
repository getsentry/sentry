from abc import ABC
from collections.abc import Mapping
from typing import Any

from django.urls import reverse

from sentry.integrations.messaging import LinkIdentityView, LinkingView, MessagingIntegrationSpec
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.types import ExternalProviderEnum, ExternalProviders
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign

from .constants import SALT


def build_linking_url(integration: RpcIntegration, discord_id: str) -> str:
    endpoint = "sentry-integration-discord-link-identity"
    kwargs = {
        "discord_id": discord_id,
        "integration_id": integration.id,
    }
    return absolute_uri(reverse(endpoint, kwargs={"signed_params": sign(salt=SALT, **kwargs)}))


class DiscordLinkingView(LinkingView, ABC):
    @property
    def parent_messaging_spec(self) -> MessagingIntegrationSpec:
        from sentry.integrations.discord.spec import DiscordMessagingSpec

        return DiscordMessagingSpec()

    @property
    def provider(self) -> ExternalProviders:
        return ExternalProviders.DISCORD

    @property
    def external_provider_enum(self) -> ExternalProviderEnum:
        return ExternalProviderEnum.DISCORD

    @property
    def salt(self) -> str:
        return SALT

    @property
    def external_id_parameter(self) -> str:
        return "discord_id"

    @property
    def expired_link_template(self) -> str:
        return "sentry/integrations/discord/expired-link.html"


class DiscordLinkIdentityView(DiscordLinkingView, LinkIdentityView):
    def get_success_template_and_context(
        self, integration: Integration, params: Mapping[str, Any]
    ) -> tuple[str, dict[str, Any]]:
        return "sentry/integrations/discord/linked.html", {}

    @property
    def success_metric(self) -> str | None:
        return "integrations.discord.identity_linked"
