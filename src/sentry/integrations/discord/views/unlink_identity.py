from django.urls import reverse

from sentry.integrations.discord.views.link_identity import DiscordLinkingView
from sentry.integrations.messaging import UnlinkIdentityView
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign


def build_unlinking_url(integration: RpcIntegration, discord_id: str) -> str:
    endpoint = "sentry-integration-discord-unlink-identity"
    kwargs = {
        "discord_id": discord_id,
        "integration_id": integration.id,
    }
    return absolute_uri(reverse(endpoint, kwargs={"signed_params": sign(**kwargs)}))


class DiscordUnlinkIdentityView(DiscordLinkingView, UnlinkIdentityView):
    @property
    def success_template(self) -> str:
        return "sentry/integrations/discord/unlinked.html"

    @property
    def success_metric(self) -> str | None:
        return "integrations.discord.identity_unlinked"
