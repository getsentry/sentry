from __future__ import annotations

from collections.abc import Callable

from django.http.request import HttpRequest

from sentry import options
from sentry.auth.partnership_configs import SPONSOR_OAUTH_NAME, ChannelName
from sentry.auth.providers.oauth2 import OAuth2Callback, OAuth2Provider
from sentry.auth.services.auth.model import RpcAuthProvider
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.base.response import DeferredResponse

from .constants import ACCESS_TOKEN_URL, AUTHORIZE_URL
from .views import FetchUser, FlyOAuth2Login, fly_configure_view


class FlyOAuth2Provider(OAuth2Provider):
    name = SPONSOR_OAUTH_NAME[ChannelName.FLY_IO]
    key = ChannelName.FLY_IO.value
    is_partner = True
    access_token_url = ACCESS_TOKEN_URL
    authorize_url = AUTHORIZE_URL

    def __init__(self, org=None, **config):
        self.org = org
        super().__init__(**config)

    def get_client_id(self):
        return options.get("auth-fly.client-id")

    def get_client_secret(self):
        return options.get("auth-fly.client-secret")

    def get_configure_view(
        self,
    ) -> Callable[[HttpRequest, RpcOrganization, RpcAuthProvider], DeferredResponse]:
        # Utilized from organization_auth_settings.py when configuring the app
        # Injected into the configuration form
        return fly_configure_view

    def get_auth_pipeline(self):
        return [
            FlyOAuth2Login(client_id=self.get_client_id()),
            OAuth2Callback(
                access_token_url=ACCESS_TOKEN_URL,
                client_id=self.get_client_id(),
                client_secret=self.get_client_secret(),
            ),
            FetchUser(org=self.org),
        ]

    def get_refresh_token_url(self) -> str:
        return ACCESS_TOKEN_URL

    @classmethod
    def build_config(self, resource):
        """
        On configuration, we determine which provider organization to configure sentry SSO for.
        This configuration is then stored and passed into the pipeline instances during SSO
        to determine whether the Auth'd user has the appropriate access to the provider org
        """
        return {"org": {"id": resource.get("id")}}

    def build_identity(self, state):
        """
        ex Response:
        {
            'resource_owner_id': 'k9d01lp82rky6vo2',
            'scope': ['read'],
            'expires_in': 7200,
            'application': {
                'uid': 'elMJpuhA5bXbR59ZaKdXrxXGFVKTypGHuJ4h6Rfw1Qk'
            },
            'created_at': 1686785304,
            'user_id': 'k9d01lp82rky6vo2',
            'user_name': 'Nathan',
            'email': 'k9d01lp82rky6vo2@customer.fly.io',
            'organizations': [
                {'id': 'g1lx9my4pzemqwk7', 'role': 'admin'},
                {'id': '0vogzmzoj1k5xp29', 'role': 'admin'}
            ]
        }
        """
        data = state["data"]
        user_data = state["user"]

        return {
            "id": user_data["user_id"],
            "email": user_data["email"],
            "name": user_data["email"],
            "data": self.get_oauth_data(data),
            "email_verified": False,
        }


class NonPartnerFlyOAuth2Provider(FlyOAuth2Provider):
    """
    When a customer is no longer on a Fly.io sponsored plan, we change their provider
    to the "non-partner" version of Fly SSO so that it can be disabled.
    """

    name = SPONSOR_OAUTH_NAME[ChannelName.FLY_NON_PARTNER]
    key = ChannelName.FLY_NON_PARTNER.value
    is_partner = False
