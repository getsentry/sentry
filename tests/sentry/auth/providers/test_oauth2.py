from collections.abc import Mapping
from functools import cached_property
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from django.http import HttpResponse
from django.test import RequestFactory

from sentry.auth.exceptions import IdentityNotValid
from sentry.auth.providers.oauth2 import ERR_PROVIDER_ERROR, OAuth2Callback, OAuth2Provider
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
class OAuth2CallbackErrorHandlingTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.callback = OAuth2Callback(client_id="client-id", client_secret="secret")
        self.factory = RequestFactory()

    def test_error_query_param_not_reflected(self) -> None:
        request = self.factory.get("/", {"error": "1-1)) OR 114=(SELECT 114 FROM PG_SLEEP(15))--"})
        pipeline = MagicMock()
        pipeline.error.return_value = HttpResponse()

        response = self.callback.dispatch(request, pipeline)

        assert response == pipeline.error.return_value
        (message,) = pipeline.error.call_args[0]
        assert message == ERR_PROVIDER_ERROR
        assert "PG_SLEEP" not in message

    def test_error_query_param_known_code(self) -> None:
        request = self.factory.get("/", {"error": "access_denied"})
        pipeline = MagicMock()
        pipeline.error.return_value = HttpResponse()

        self.callback.dispatch(request, pipeline)

        (message,) = pipeline.error.call_args[0]
        assert message.endswith("access_denied")

    def test_exchange_token_error_known_code(self) -> None:
        request = self.factory.get("/", {"state": "abc", "code": "123"})
        pipeline = MagicMock()
        pipeline.error.return_value = HttpResponse()
        pipeline.fetch_state.return_value = "abc"

        with patch.object(self.callback, "exchange_token", return_value={"error": "access_denied"}):
            self.callback.dispatch(request, pipeline)

        (message,) = pipeline.error.call_args[0]
        assert "access_denied" in message
