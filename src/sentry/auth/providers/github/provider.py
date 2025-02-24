from __future__ import annotations

from collections.abc import Callable

from django.http.request import HttpRequest

from sentry.auth.exceptions import IdentityNotValid
from sentry.auth.providers.oauth2 import OAuth2Callback, OAuth2Login, OAuth2Provider
from sentry.auth.services.auth.model import RpcAuthProvider
from sentry.models.authidentity import AuthIdentity
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.base.response import DeferredResponse

from .client import GitHubApiError, GitHubClient
from .constants import ACCESS_TOKEN_URL, AUTHORIZE_URL, CLIENT_ID, CLIENT_SECRET, SCOPE
from .views import ConfirmEmail, FetchUser, SelectOrganization, github_configure_view


class GitHubOAuth2Provider(OAuth2Provider):
    access_token_url = ACCESS_TOKEN_URL
    authorize_url = AUTHORIZE_URL
    name = "GitHub"
    key = "github"

    def get_client_id(self):
        return CLIENT_ID

    def get_client_secret(self):
        return CLIENT_SECRET

    def __init__(self, org=None, **config):
        super().__init__(**config)
        self.org = org

    def get_configure_view(
        self,
    ) -> Callable[[HttpRequest, RpcOrganization, RpcAuthProvider], DeferredResponse]:
        return github_configure_view

    def get_auth_pipeline(self):
        return [
            OAuth2Login(
                authorize_url=self.authorize_url, client_id=self.get_client_id(), scope=SCOPE
            ),
            OAuth2Callback(
                access_token_url=self.access_token_url,
                client_id=self.get_client_id(),
                client_secret=self.get_client_secret(),
            ),
            FetchUser(org=self.org),
            ConfirmEmail(),
        ]

    def get_setup_pipeline(self):
        pipeline = self.get_auth_pipeline()
        pipeline.append(SelectOrganization())
        return pipeline

    def get_refresh_token_url(self) -> str:
        return ACCESS_TOKEN_URL

    def build_config(self, state):
        """
        On configuration, we determine which provider organization to configure SSO for
        This configuration is then stored and passed into the pipeline instances during SSO
        to determine whether the Auth'd user has the appropriate access to the provider org
        """
        return {"org": {"id": state["org"]["id"], "name": state["org"]["login"]}}

    def build_identity(self, state):
        data = state["data"]
        user_data = state["user"]
        return {
            "id": user_data["id"],
            "email": user_data["email"],
            "name": user_data["name"],
            "data": self.get_oauth_data(data),
        }

    def refresh_identity(self, auth_identity: AuthIdentity) -> None:
        with GitHubClient(auth_identity.data["access_token"]) as client:
            try:
                if not client.is_org_member(self.org["id"]):
                    raise IdentityNotValid
            except GitHubApiError as e:
                raise IdentityNotValid(e)
