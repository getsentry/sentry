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


@control_silo_test
class OAuth2CallbackTest(TestCase):
    """Test OAuth2Callback view for security vulnerabilities"""

    def setUp(self) -> None:
        super().setUp()
        self.view = OAuth2Callback(
            access_token_url="https://example.org/oauth/token",
            client_id="test-client-id",
            client_secret="test-client-secret",
        )

    def test_error_parameter_sanitization(self) -> None:
        """Test that malicious error parameters are sanitized"""
        # Simulate Acunetix scanner payload
        malicious_error = '1ACUSTART\'"*/\r\n <?phpACUEND'
        request = RequestFactory().get("/?error=" + malicious_error)
        request.session = Client().session
        request.subdomain = None

        # Create a mock pipeline
        from unittest.mock import MagicMock

        pipeline = MagicMock(spec=AuthHelper)
        pipeline.error = MagicMock(return_value="error_response")

        self.view.dispatch(request, pipeline)

        # Verify the error method was called with sanitized input
        pipeline.error.assert_called_once()
        sanitized_error = pipeline.error.call_args[0][0]

        # Should not contain dangerous characters
        assert "<?" not in sanitized_error
        assert "*/" not in sanitized_error
        assert '"' not in sanitized_error
        assert "'" not in sanitized_error
        assert "\r" not in sanitized_error
        assert "\n" not in sanitized_error
        # Should only contain safe characters
        assert all(c.isalnum() or c in " .-_" for c in sanitized_error)

    def test_error_parameter_xss_attempt(self) -> None:
        """Test that XSS attempts in error parameter are neutralized"""
        xss_error = '<script>alert("xss")</script>'
        request = RequestFactory().get("/?error=" + xss_error)
        request.session = Client().session
        request.subdomain = None

        from unittest.mock import MagicMock

        pipeline = MagicMock(spec=AuthHelper)
        pipeline.error = MagicMock(return_value="error_response")

        self.view.dispatch(request, pipeline)

        # Verify the error method was called with sanitized input
        pipeline.error.assert_called_once()
        sanitized_error = pipeline.error.call_args[0][0]

        # Should not contain script tags or angle brackets
        assert "<" not in sanitized_error
        assert ">" not in sanitized_error
        assert "script" in sanitized_error  # The word itself is okay, just not the tags

    def test_error_parameter_length_limit(self) -> None:
        """Test that very long error parameters are truncated"""
        long_error = "A" * 500
        request = RequestFactory().get("/?error=" + long_error)
        request.session = Client().session
        request.subdomain = None

        from unittest.mock import MagicMock

        pipeline = MagicMock(spec=AuthHelper)
        pipeline.error = MagicMock(return_value="error_response")

        self.view.dispatch(request, pipeline)

        # Verify the error method was called with truncated input
        pipeline.error.assert_called_once()
        sanitized_error = pipeline.error.call_args[0][0]

        # Should be truncated to 200 characters
        assert len(sanitized_error) <= 200
