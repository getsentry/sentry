from django.urls import reverse

from sentry.integrations.messaging import LinkIdentityView, MessagingIntegrationSpec
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign


def build_linking_url(integration: RpcIntegration, discord_id: str) -> str:
    endpoint = "sentry-integration-discord-link-identity"
    kwargs = {
        "discord_id": discord_id,
        "integration_id": integration.id,
    }
    return absolute_uri(reverse(endpoint, kwargs={"signed_params": sign(**kwargs)}))


class DiscordLinkIdentityView(LinkIdentityView):
    @property
    def parent_messaging_spec(self) -> MessagingIntegrationSpec:
        from sentry.integrations.discord import DiscordMessagingSpec

        return DiscordMessagingSpec()

    @property
    def expired_link_template(self) -> str:
        return "sentry/integrations/discord/expired-link.html"

    @property
    def linked_template(self) -> str:
        return "sentry/integrations/discord/linked.html"
