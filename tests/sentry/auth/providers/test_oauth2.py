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
    """Tests for OAuth2Callback view error handling"""

    def setUp(self) -> None:
        from django.test import RequestFactory

        from sentry.auth.helper import AuthHelper
        from sentry.auth.providers.oauth2 import OAuth2Callback

        super().setUp()
        self.auth_provider = AuthProvider.objects.create(
            provider="oauth2", organization_id=self.organization.id
        )
        self.request_factory = RequestFactory()
        self.view = OAuth2Callback(
            access_token_url="https://example.org/oauth/token",
            client_id="test-client-id",
            client_secret="test-client-secret",
        )

    def test_dispatch_with_error_parameter_sanitized(self) -> None:
        """Test that error parameter from OAuth provider is sanitized and not displayed"""
        from django.test import Client

        from sentry.auth.helper import AuthHelper

        malicious_error = "ACUSTART'\"(z)ACUEND"
        request = self.request_factory.get("/", {"error": malicious_error})
        request.session = Client().session
        request.subdomain = None
        request.user = self.user

        helper = AuthHelper.get_for_request(request)
        if helper is None:
            helper = AuthHelper(
                request=request,
                organization=self.organization,
                provider_key="oauth2_dummy",
                flow=1,  # AuthFlow.LOGIN
            )
            helper.initialize()

        response = self.view.dispatch(request, helper)

        # The response should contain a generic error message, not the malicious string
        assert response.status_code == 200
        content = response.content.decode()
        assert "An error occurred while validating your request" in content
        # The malicious string should NOT be in the response
        assert malicious_error not in content

    def test_dispatch_with_legitimate_error(self) -> None:
        """Test that legitimate OAuth errors are handled safely"""
        from django.test import Client

        from sentry.auth.helper import AuthHelper

        legitimate_error = "access_denied"
        request = self.request_factory.get("/", {"error": legitimate_error})
        request.session = Client().session
        request.subdomain = None
        request.user = self.user

        helper = AuthHelper.get_for_request(request)
        if helper is None:
            helper = AuthHelper(
                request=request,
                organization=self.organization,
                provider_key="oauth2_dummy",
                flow=1,  # AuthFlow.LOGIN
            )
            helper.initialize()

        response = self.view.dispatch(request, helper)

        # The response should contain a generic error message
        assert response.status_code == 200
        content = response.content.decode()
        assert "An error occurred while validating your request" in content
        # The specific error should NOT be in the response
        assert legitimate_error not in content
