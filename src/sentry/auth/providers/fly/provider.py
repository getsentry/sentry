from sentry.auth.partnership_config import SPONSOR_OAUTH_NAME, ChannelName
from sentry.auth.providers.oauth2 import OAuth2Provider


class FlyOAuth2Provider(OAuth2Provider):

    name = SPONSOR_OAUTH_NAME[ChannelName.FLY_IO]
    is_partner = True

    # TODO: (nhsiehgit) Replace boilerplate code
    def get_refresh_token_url(self) -> str:
        return ""

    def build_identity(self, state):
        return {"id": "", "email": ""}
