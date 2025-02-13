from __future__ import annotations

from collections.abc import Callable

import jwt
from django.http.request import HttpRequest

from sentry import options
from sentry.auth.partnership_configs import SPONSOR_OAUTH_NAME, ChannelName
from sentry.auth.providers.oauth2 import OAuth2Provider
from sentry.auth.services.auth.model import RpcAuthProvider
from sentry.identity.oauth2 import OAuth2CallbackView
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.base.response import DeferredResponse

from .constants import ACCESS_TOKEN_URL, AUTHORIZE_URL
from .views import vercel_configure_view


class VercelOAuth2Provider(OAuth2Provider):
    """
    OAuth2 provider for Vercel Native integration, not
    to be confused with standard, already existing Vercel OAuth2 provider.
    """

    is_partner = True
    name = SPONSOR_OAUTH_NAME[ChannelName.VERCEL]
    access_token_url = ACCESS_TOKEN_URL
    authorize_url = AUTHORIZE_URL

    def get_client_id(self):
        return options.get("vercel.client-id")

    def get_client_secret(self):
        return options.get("vercel.client-secret")

    def get_configure_view(
        self,
    ) -> Callable[[HttpRequest, RpcOrganization, RpcAuthProvider], DeferredResponse | str]:
        return vercel_configure_view

    @classmethod
    def build_config(cls, resource):
        """
        On configuration, we determine which provider organization to configure sentry SSO for.
        This configuration is then stored and passed into the pipeline instances during SSO
        to determine whether the Auth'd user has the appropriate access to the provider org
        """
        return {"org": {"id": resource.get("id")}}

    def get_pipeline_views(self):
        return [
            OAuth2CallbackView(
                access_token_url=self.access_token_url,
                client_id=self.get_client_id(),
                client_secret=self.get_client_secret(),
            ),
        ]

    def get_refresh_token_url(self):
        return ACCESS_TOKEN_URL

    def build_identity(self, state):
        """
        As a part of response we get an id_token from Vercel which has the needed claims.
        """

        data = state["data"]
        decoded_id_token = jwt.decode(data["id_token"], options={"verify_signature": False})
        return {
            "type": "vercel",
            "id": decoded_id_token["user_id"],
            "email": decoded_id_token["user_email"],
            "name": decoded_id_token["user_name"],
            "data": self.get_oauth_data(data),
            "email_verified": True,
        }
