from typing import NoReturn

from sentry.identity.oauth2 import OAuth2Provider
from sentry.integrations.types import IntegrationProviderSlug


class GitHubEnterpriseIdentityProvider(OAuth2Provider):
    key = IntegrationProviderSlug.GITHUB_ENTERPRISE.value
    name = "GitHub Enterprise"

    oauth_scopes = ()

    def build_identity(self, data: object) -> NoReturn:
        raise NotImplementedError
