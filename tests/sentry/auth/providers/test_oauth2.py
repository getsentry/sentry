from functools import cached_property
from typing import Any, Mapping

import pytest

from sentry.auth.exceptions import IdentityNotValid
from sentry.auth.providers.oauth2 import OAuth2Provider
from sentry.models import AuthIdentity, AuthProvider
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test


class DummyOAuth2Provider(OAuth2Provider):
    name = "dummy"

    def get_refresh_token_url(self) -> str:
        pass

    def build_identity(self, state: Mapping[str, Any]) -> Mapping[str, Any]:
        pass

    def build_config(self, state):
        pass


@control_silo_test
class OAuth2ProviderTest(TestCase):
    @cached_property
    def auth_provider(self):
        return AuthProvider.objects.create(provider="oauth2", organization=self.organization)

    def test_refresh_identity_without_refresh_token(self):
        auth_identity = AuthIdentity.objects.create(
            auth_provider=self.auth_provider,
            user=self.user,
            data={"access_token": "access_token"},
        )

        provider = DummyOAuth2Provider(key=self.auth_provider.provider)
        with pytest.raises(IdentityNotValid):
            provider.refresh_identity(auth_identity)
