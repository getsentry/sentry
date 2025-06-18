from sentry.auth.provider import Provider


class DiscordIdentityProvider(Provider):
    key = "discord"
    name = "Discord"
