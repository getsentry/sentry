from collections.abc import Mapping
from functools import cached_property
from typing import Any

import pytest

from sentry.auth.exceptions import IdentityNotValid
from sentry.auth.providers.oauth2 import OAuth2Provider
from sentry.models.authidentity import AuthIdentity
from sentry.models.authprovider import AuthProvider
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


class DummyOAuth2Provider(OAuth2Provider):
    name = "dummy"
    key = "oauth2_dummy"

    def get_client_id(self) -> str:
        raise NotImplementedError

    def get_client_secret(self) -> str:
        raise NotImplementedError

    def get_refresh_token_url(self) -> str:
        raise NotImplementedError

    def build_identity(self, state: Mapping[str, Any]) -> Mapping[str, Any]:
        raise NotImplementedError

    def build_config(self, state):
        raise NotImplementedError


@control_silo_test
class OAuth2ProviderTest(TestCase):
    @cached_property
    def auth_provider(self):
        return AuthProvider.objects.create(provider="oauth2", organization_id=self.organization.id)

    def test_refresh_identity_without_refresh_token(self) -> None:
        auth_identity = AuthIdentity.objects.create(
            auth_provider=self.auth_provider,
            user=self.user,
            data={"access_token": "access_token"},
        )

        provider = DummyOAuth2Provider()
        with pytest.raises(IdentityNotValid):
            provider.refresh_identity(auth_identity)

    def test_refresh_identity_without_client_id(self) -> None:
        """Test that refresh_identity raises IdentityNotValid when client_id is not configured"""
        auth_identity = AuthIdentity.objects.create(
            auth_provider=self.auth_provider,
            user=self.user,
            data={"access_token": "access_token", "refresh_token": "refresh_token"},
        )

        class NoClientIdProvider(DummyOAuth2Provider):
            def get_client_id(self) -> str:
                return ""

            def get_client_secret(self) -> str:
                return "client_secret"

            def get_refresh_token_url(self) -> str:
                return "https://example.com/oauth/token"

        provider = NoClientIdProvider()
        with pytest.raises(IdentityNotValid, match="OAuth2 client_id is not configured"):
            provider.refresh_identity(auth_identity)

    def test_refresh_identity_without_client_secret(self) -> None:
        """Test that refresh_identity raises IdentityNotValid when client_secret is not configured"""
        auth_identity = AuthIdentity.objects.create(
            auth_provider=self.auth_provider,
            user=self.user,
            data={"access_token": "access_token", "refresh_token": "refresh_token"},
        )

        class NoClientSecretProvider(DummyOAuth2Provider):
            def get_client_id(self) -> str:
                return "client_id"

            def get_client_secret(self) -> str:
                return ""

            def get_refresh_token_url(self) -> str:
                return "https://example.com/oauth/token"

        provider = NoClientSecretProvider()
        with pytest.raises(IdentityNotValid, match="OAuth2 client_secret is not configured"):
            provider.refresh_identity(auth_identity)

    def test_refresh_identity_with_none_client_secret(self) -> None:
        """Test that refresh_identity raises IdentityNotValid when client_secret returns None"""
        auth_identity = AuthIdentity.objects.create(
            auth_provider=self.auth_provider,
            user=self.user,
            data={"access_token": "access_token", "refresh_token": "refresh_token"},
        )

        class NoneClientSecretProvider(DummyOAuth2Provider):
            def get_client_id(self) -> str:
                return "client_id"

            def get_client_secret(self) -> str:
                return None  # type: ignore[return-value]

            def get_refresh_token_url(self) -> str:
                return "https://example.com/oauth/token"

        provider = NoneClientSecretProvider()
        with pytest.raises(IdentityNotValid, match="OAuth2 client_secret is not configured"):
            provider.refresh_identity(auth_identity)
