from collections.abc import Mapping
from typing import Any

from django.urls import reverse

from sentry.integrations.discord.views.linkage import DiscordIdentityLinkageView
from sentry.integrations.messaging.linkage import LinkIdentityView
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.model import RpcIntegration
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


class DiscordLinkIdentityView(DiscordIdentityLinkageView, LinkIdentityView):
    def get_success_template_and_context(
        self, params: Mapping[str, Any], integration: Integration | None
    ) -> tuple[str, dict[str, Any]]:
        if integration is None:
            raise ValueError(
                'integration is required for linking (params must include "integration_id")'
            )
        return "sentry/integrations/discord/linked.html", {
            "guild_id": integration.external_id,
        }

    @property
    def analytics_operation_key(self) -> str | None:
        return "identity_linked"
