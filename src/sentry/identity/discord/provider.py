from sentry.auth.providers.oauth2 import OAuth2Provider


class DiscordIdentityProvider(OAuth2Provider):
    key = "discord"
    name = "Discord"

    # We don't actually use OAuth2 for Discord identities, so this class is
    # just here so we can register a provider.
