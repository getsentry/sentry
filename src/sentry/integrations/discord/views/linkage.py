from abc import ABC

from sentry.integrations.messaging.linkage import IdentityLinkageView
from sentry.integrations.messaging.spec import MessagingIntegrationSpec
from sentry.integrations.types import ExternalProviderEnum, ExternalProviders

from .constants import SALT


class DiscordIdentityLinkageView(IdentityLinkageView, ABC):
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
