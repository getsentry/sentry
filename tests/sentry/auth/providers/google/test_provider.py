from __future__ import absolute_import

import pytest

from sentry.auth.exceptions import IdentityNotValid
from sentry.models import AuthIdentity, AuthProvider
from sentry.testutils import TestCase

from sentry.auth.providers.google.constants import DATA_VERSION


class GoogleOAuth2ProviderTest(TestCase):
    def setUp(self):
        self.org = self.create_organization(owner=self.user)
        self.user = self.create_user("foo@example.com")
        self.auth_provider = AuthProvider.objects.create(provider="google", organization=self.org)
        super(GoogleOAuth2ProviderTest, self).setUp()

    def test_refresh_identity_without_refresh_token(self):
        auth_identity = AuthIdentity.objects.create(
            auth_provider=self.auth_provider, user=self.user, data={"access_token": "access_token"}
        )

        provider = self.auth_provider.get_provider()

        with pytest.raises(IdentityNotValid):
            provider.refresh_identity(auth_identity)

    def test_handles_multiple_domains(self):
        self.auth_provider.update(config={"domains": ["example.com"]})

        provider = self.auth_provider.get_provider()
        assert provider.domains == ["example.com"]

    def test_handles_legacy_single_domain(self):
        self.auth_provider.update(config={"domain": "example.com"})

        provider = self.auth_provider.get_provider()
        assert provider.domains == ["example.com"]

    def test_build_config(self):
        provider = self.auth_provider.get_provider()
        state = {
            "domain": "example.com",
            "user": {
                "iss": "accounts.google.com",
                "at_hash": "HK6E_P6Dh8Y93mRNtsDB1Q",
                "email_verified": "true",
                "sub": "10769150350006150715113082367",
                "azp": "1234987819200.apps.googleusercontent.com",
                "email": "jsmith@example.com",
                "aud": "1234987819200.apps.googleusercontent.com",
                "iat": 1353601026,
                "exp": 1353604926,
                "hd": "example.com",
            },
        }
        result = provider.build_config(state)
        assert result == {"domains": ["example.com"], "version": DATA_VERSION}
