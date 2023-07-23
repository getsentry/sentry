from sentry.auth.providers.oauth2 import OAuth2Provider


class DiscordIdentityProvider(OAuth2Provider):
    key = "discord"
    name = "Discord"

    # https://discord.com/developers/docs/topics/oauth2#shared-resources-oauth2-scopes
    oauth_scope = ("identity", "email")

    def get_oauth_authorize_url(self):
        return "https://discord.com/oauth2/authorize"

    def get_oauth_token_url(self):
        return "https://discord.com/api/oauth2/token"
