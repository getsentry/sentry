from collections.abc import Mapping
from typing import Any

from django.urls import reverse

from sentry.integrations.discord.views.link_identity import DiscordLinkingView
from sentry.integrations.messaging import UnlinkIdentityView
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign

from .constants import SALT


def build_unlinking_url(integration: RpcIntegration, discord_id: str) -> str:
    endpoint = "sentry-integration-discord-unlink-identity"
    kwargs = {
        "discord_id": discord_id,
        "integration_id": integration.id,
    }
    return absolute_uri(reverse(endpoint, kwargs={"signed_params": sign(salt=SALT, **kwargs)}))


class DiscordUnlinkIdentityView(DiscordLinkingView, UnlinkIdentityView):
    def get_success_template_and_context(
        self, params: Mapping[str, Any], integration: Integration | None
    ) -> tuple[str, dict[str, Any]]:
        return "sentry/integrations/discord/unlinked.html", {}

    @property
    def success_metric(self) -> str | None:
        return "integrations.discord.identity_unlinked"
