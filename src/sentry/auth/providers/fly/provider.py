from typing import Any, Dict, Optional, cast

from sentry import options
from sentry.auth.partnership_configs import SPONSOR_OAUTH_NAME, ChannelName
from sentry.auth.providers.oauth2 import OAuth2Callback, OAuth2Provider

from .constants import ACCESS_TOKEN_URL, AUTHORIZE_URL
from .views import FetchUser, FlyConfigureView, FlyOAuth2Login


class FlyOAuth2Provider(OAuth2Provider):
    name = SPONSOR_OAUTH_NAME[ChannelName.FLY_IO]
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

    def get_configure_view(self):
        # Utilized from organization_auth_settings.py when configuring the app
        # Injected into the configuration form
        return FlyConfigureView.as_view()

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

    def get_refresh_token_url(self):
        return ACCESS_TOKEN_URL

    @classmethod
    def build_config(self, resource: Optional[Any] = None):
        """
        On configuration, we determine which provider organization to configure sentry SSO for.
        This configuration is then stored and passed into the pipeline instances during SSO
        to determine whether the Auth'd user has the appropriate access to the provider org
        """
        return {"org": {"id": cast(Dict, resource).get("id")}}

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
