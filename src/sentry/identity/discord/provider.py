from sentry.auth.provider import Provider
from sentry.integrations.types import IntegrationProviderSlug


class DiscordIdentityProvider(Provider):
    key = IntegrationProviderSlug.DISCORD.value
    name = "Discord"
