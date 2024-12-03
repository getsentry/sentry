from typing import NoReturn

from sentry.identity.oauth2 import OAuth2Provider


class GitHubEnterpriseIdentityProvider(OAuth2Provider):
    key = "github_enterprise"
    name = "GitHub Enterprise"

    oauth_scopes = ()

    def build_identity(self, data: object) -> NoReturn:
        raise NotImplementedError
