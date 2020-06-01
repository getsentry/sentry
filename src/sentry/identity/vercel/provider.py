from __future__ import absolute_import

from sentry import http, options

from sentry.identity.oauth2 import OAuth2Provider, OAuth2LoginView, OAuth2CallbackView
from sentry.utils.http import absolute_uri


class VercelIdentityProvider(OAuth2Provider):
    key = "vercel"
    name = "Vercel"

    oauth_access_token_url = "https://api.vercel.com/v2/oauth/access_token"
    oauth_authorize_url = "https://vercel.com/integrations/steve-sentry-integration/add"

    def get_oauth_client_id(self):
        return options.get("vercel.client-id")

    def get_oauth_client_secret(self):
        return options.get("vercel.client-secret")

    def get_refresh_token_url(self):
        return self.oauth_access_token_url

    def get_pipeline_views(self):
        return [
            OAuth2LoginView(
                authorize_url=self.oauth_authorize_url, client_id=self.get_oauth_client_id(),
            ),
            OAuth2CallbackView(
                access_token_url=self.oauth_access_token_url,
                client_id=self.get_oauth_client_id(),
                client_secret=self.get_oauth_client_secret(),
            ),
        ]

    def build_identity(self, data):
        print("build_identity", data)
        return {
            "type": "vercel",
        }


# class VercelAuth2CallbackView(OAuth2CallbackView):
#     def exchange_token(self, request, pipeline, code):
#         print("exchange_token", code)
