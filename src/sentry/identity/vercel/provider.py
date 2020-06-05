from __future__ import absolute_import

from sentry import options
from sentry.identity.oauth2 import OAuth2Provider, OAuth2CallbackView


class VercelIdentityProvider(OAuth2Provider):
    key = "vercel"
    name = "Vercel"

    oauth_access_token_url = "https://api.vercel.com/v2/oauth/access_token"

    def get_oauth_client_id(self):
        return options.get("vercel.client-id")

    def get_oauth_client_secret(self):
        return options.get("vercel.client-secret")

    def get_refresh_token_url(self):
        return self.oauth_access_token_url

    def get_pipeline_views(self):
        return [
            OAuth2CallbackView(
                access_token_url=self.oauth_access_token_url,
                client_id=self.get_oauth_client_id(),
                client_secret=self.get_oauth_client_secret(),
            ),
        ]
