from abc import ABC

from django.urls import reverse

from sentry.integrations.messaging import LinkIdentityView, LinkingView, MessagingIntegrationSpec
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.types import ExternalProviders
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign


def build_linking_url(integration: RpcIntegration, discord_id: str) -> str:
    endpoint = "sentry-integration-discord-link-identity"
    kwargs = {
        "discord_id": discord_id,
        "integration_id": integration.id,
    }
    return absolute_uri(reverse(endpoint, kwargs={"signed_params": sign(**kwargs)}))


class DiscordLinkingView(LinkingView, ABC):
    @property
    def parent_messaging_spec(self) -> MessagingIntegrationSpec:
        from sentry.integrations.discord.spec import DiscordMessagingSpec

        return DiscordMessagingSpec()

    @property
    def provider(self) -> ExternalProviders:
        return ExternalProviders.DISCORD

    @property
    def salt(self) -> str:
        from .constants import SALT

        return SALT

    @property
    def external_id_parameter(self) -> str:
        return "discord_id"

    @property
    def expired_link_template(self) -> str:
        return "sentry/integrations/discord/expired-link.html"


class DiscordLinkIdentityView(DiscordLinkingView, LinkIdentityView):
    @property
    def success_template(self) -> str:
        return "sentry/integrations/discord/linked.html"

    @property
    def success_metric(self) -> str | None:
        return "integrations.discord.identity_linked"
