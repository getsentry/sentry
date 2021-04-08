from sentry.auth.exceptions import IdentityNotValid
from sentry.auth.providers.oauth2 import OAuth2Callback, OAuth2Login, OAuth2Provider

from .client import GitHubApiError, GitHubClient
from .constants import ACCESS_TOKEN_URL, AUTHORIZE_URL, CLIENT_ID, CLIENT_SECRET, SCOPE
from .views import ConfirmEmail, FetchUser, GitHubConfigureView, SelectOrganization


class GitHubOAuth2Provider(OAuth2Provider):
    access_token_url = ACCESS_TOKEN_URL
    authorize_url = AUTHORIZE_URL
    name = "GitHub"
    client_id = CLIENT_ID
    client_secret = CLIENT_SECRET

    def __init__(self, org=None, **config):
        super().__init__(**config)
        self.org = org

    def get_configure_view(self):
        return GitHubConfigureView.as_view()

    def get_auth_pipeline(self):
        return [
            OAuth2Login(authorize_url=self.authorize_url, client_id=self.client_id, scope=SCOPE),
            OAuth2Callback(
                access_token_url=self.access_token_url,
                client_id=self.client_id,
                client_secret=self.client_secret,
            ),
            FetchUser(org=self.org),
            ConfirmEmail(),
        ]

    def get_setup_pipeline(self):
        pipeline = self.get_auth_pipeline()
        pipeline.append(SelectOrganization())
        return pipeline

    def get_refresh_token_url(self):
        return ACCESS_TOKEN_URL

    def build_config(self, state):
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

    def refresh_identity(self, auth_identity):
        client = GitHubClient(auth_identity.data["access_token"])

        try:
            if not client.is_org_member(self.org["id"]):
                raise IdentityNotValid
        except GitHubApiError as e:
            raise IdentityNotValid(e)
