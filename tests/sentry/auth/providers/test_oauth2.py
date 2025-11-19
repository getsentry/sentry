from collections.abc import Mapping
from functools import cached_property
from unittest.mock import MagicMock
from typing import Any

import pytest
from django.test import RequestFactory

from sentry.auth.exceptions import IdentityNotValid
from sentry.auth.providers.oauth2 import ERR_INVALID_STATE, OAuth2Callback, OAuth2Provider
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


class OAuth2CallbackTest(TestCase):
    def setUp(self) -> None:
        self.request_factory = RequestFactory()
        self.callback = OAuth2Callback(
            access_token_url="https://example.org/token",
            client_id="client-id",
            client_secret="client-secret",
        )

    def test_error_param_uses_sanitized_code(self) -> None:
        request = self.request_factory.get("/", {"error": "access_denied"})
        request.subdomain = None
        pipeline = MagicMock()

        self.callback.dispatch(request, pipeline)

        pipeline.error.assert_called_once_with(f"{ERR_INVALID_STATE}\nError code: access_denied")

    def test_error_param_omitted_when_invalid(self) -> None:
        request = self.request_factory.get("/", {"error": "(select(0)from(select(sleep(15)))v)"})
        request.subdomain = None
        pipeline = MagicMock()

        self.callback.dispatch(request, pipeline)

        pipeline.error.assert_called_once_with(ERR_INVALID_STATE)
