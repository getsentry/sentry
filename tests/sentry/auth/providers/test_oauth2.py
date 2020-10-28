from __future__ import absolute_import, print_function

import pytest
from exam import fixture

from sentry.auth.exceptions import IdentityNotValid
from sentry.auth.providers.oauth2 import OAuth2Provider
from sentry.models import AuthIdentity, AuthProvider
from sentry.testutils import TestCase


class OAuth2ProviderTest(TestCase):
    def setUp(self):
        self.org = self.create_organization(owner=self.user)
        self.user = self.create_user("foo@example.com")
        super(OAuth2ProviderTest, self).setUp()

    @fixture
    def auth_provider(self):
        return AuthProvider.objects.create(provider="oauth2", organization=self.org)

    @fixture
    def provider(self):
        return OAuth2Provider(key=self.auth_provider.provider)

    def test_refresh_identity_without_refresh_token(self):
        auth_identity = AuthIdentity.objects.create(
            auth_provider=self.auth_provider, user=self.user, data={"access_token": "access_token"}
        )

        provider = OAuth2Provider(key=self.auth_provider.provider)
        with pytest.raises(IdentityNotValid):
            provider.refresh_identity(auth_identity)
