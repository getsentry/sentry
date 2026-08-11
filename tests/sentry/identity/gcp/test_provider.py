from __future__ import annotations

import base64
from functools import cached_property
from typing import Any
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, parse_qsl, urlparse

import pytest
import responses
from django.contrib.messages.storage.fallback import FallbackStorage
from django.contrib.sessions.backends.base import SessionBase
from django.test import Client, RequestFactory

import sentry.identity
from sentry.auth.exceptions import IdentityNotValid
from sentry.identity.gcp.provider import (
    GCPIdentityProvider,
    GCPOAuth2LoginView,
)
from sentry.identity.oauth2 import OAuth2CallbackView
from sentry.identity.pipeline import IdentityPipeline
from sentry.identity.providers.dummy import DummyProvider
from sentry.integrations.gcp.utils import GCP_MCP_URLS
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.identity import IdentityProvider
from sentry.utils import json

AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"


def _make_id_token(claims: dict[str, Any]) -> str:
    header = base64.urlsafe_b64encode(json.dumps({"alg": "RS256"}).encode()).rstrip(b"=").decode()
    payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).rstrip(b"=").decode()
    return f"{header}.{payload}.dummy_signature"


@control_silo_test
class GCPOAuth2LoginViewTest(TestCase):
    def setUp(self) -> None:
        sentry.identity.register(DummyProvider)
        super().setUp()
        self.request = RequestFactory().get("/")
        self.request.session = Client().session
        self.request.user = self.user
        self.request.subdomain = None

    def tearDown(self) -> None:
        super().tearDown()
        sentry.identity.unregister(DummyProvider)

    @cached_property
    def view(self):
        return GCPOAuth2LoginView(
            authorize_url=AUTHORIZE_URL,
            client_id="test-client-id",
            scope="openid email",
        )

    def _make_pipeline(self) -> IdentityPipeline:
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        pipeline.initialize()
        return pipeline

    def test_includes_access_type_offline(self) -> None:
        pipeline = self._make_pipeline()
        response = self.view.dispatch(self.request, pipeline)

        assert response.status_code == 302
        query = parse_qs(urlparse(response["Location"]).query)
        assert query["access_type"] == ["offline"]

    def test_includes_prompt_consent(self) -> None:
        pipeline = self._make_pipeline()
        response = self.view.dispatch(self.request, pipeline)

        query = parse_qs(urlparse(response["Location"]).query)
        assert query["prompt"] == ["consent"]

    def test_preserves_standard_oauth_params(self) -> None:
        pipeline = self._make_pipeline()
        response = self.view.dispatch(self.request, pipeline)

        query = parse_qs(urlparse(response["Location"]).query)
        assert query["client_id"] == ["test-client-id"]
        assert query["response_type"] == ["code"]
        assert query["scope"] == ["openid email"]
        assert "state" in query


@control_silo_test
class GCPIdentityProviderTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.provider = GCPIdentityProvider()

    def test_build_identity_from_id_token(self) -> None:
        id_token = _make_id_token(
            {"sub": "google-user-123", "email": "user@example.com", "name": "Test User"}
        )
        result = self.provider.build_identity(
            {
                "data": {
                    "id_token": id_token,
                    "access_token": "token-abc",
                    "refresh_token": "refresh-xyz",
                    "expires_in": 3600,
                    "token_type": "Bearer",
                }
            }
        )

        assert result["id"] == "google-user-123"
        assert result["email"] == "user@example.com"
        assert result["name"] == "Test User"
        assert result["type"] == "gcp"
        assert result["data"]["access_token"] == "token-abc"
        assert result["data"]["refresh_token"] == "refresh-xyz"
        assert "expires" in result["data"]
        assert result["data"]["token_type"] == "Bearer"

    def test_build_identity_name_falls_back_to_email(self) -> None:
        id_token = _make_id_token({"sub": "google-user-123", "email": "user@example.com"})
        result = self.provider.build_identity(
            {"data": {"id_token": id_token, "access_token": "token", "refresh_token": "token"}}
        )
        assert result["name"] == "user@example.com"

    def test_build_identity_missing_refresh_token(self) -> None:
        with pytest.raises(IdentityNotValid, match="Missing refresh_token"):
            self.provider.build_identity({"data": {"id_token": "token", "access_token": "token"}})

    def test_build_identity_missing_id_token(self) -> None:
        with pytest.raises(IdentityNotValid, match="Missing id_token"):
            self.provider.build_identity(
                {"data": {"access_token": "token", "refresh_token": "token"}}
            )

    def test_build_identity_missing_sub(self) -> None:
        id_token = _make_id_token({"email": "user@example.com"})
        with pytest.raises(IdentityNotValid, match="Missing sub claim"):
            self.provider.build_identity(
                {"data": {"id_token": id_token, "access_token": "token", "refresh_token": "token"}}
            )

    def test_build_identity_malformed_jwt(self) -> None:
        with pytest.raises(IdentityNotValid, match="Unable to decode id_token"):
            self.provider.build_identity(
                {"data": {"id_token": "not-a-jwt", "refresh_token": "token"}}
            )

    def test_build_identity_invalid_json_payload(self) -> None:
        header = base64.urlsafe_b64encode(b"{}").rstrip(b"=").decode()
        payload = base64.urlsafe_b64encode(b"not-json").rstrip(b"=").decode()
        bad_token = f"{header}.{payload}.sig"

        with pytest.raises(IdentityNotValid, match="Unable to decode id_token payload"):
            self.provider.build_identity(
                {"data": {"id_token": bad_token, "refresh_token": "token"}}
            )

    def test_get_refresh_token_url(self) -> None:
        assert self.provider.get_refresh_token_url() == TOKEN_URL

    @patch("sentry.identity.gcp.provider.options.get")
    def test_get_refresh_token_params(self, mock_options: MagicMock) -> None:
        mock_options.side_effect = lambda key: {
            "gcp.client-id": "my-client-id",
            "gcp.client-secret": "my-client-secret",
        }[key]

        identity = MagicMock()
        params = self.provider.get_refresh_token_params("refresh-token-123", identity)

        assert params == {
            "grant_type": "refresh_token",
            "refresh_token": "refresh-token-123",
            "client_id": "my-client-id",
            "client_secret": "my-client-secret",
        }

    def test_build_mcp_urls(self) -> None:
        urls = self.provider.build_mcp_urls({})
        assert urls == list(GCP_MCP_URLS)
        assert len(urls) == 3
        assert "https://logging.googleapis.com/mcp" in urls
        assert "https://monitoring.googleapis.com/mcp" in urls
        assert "https://cloudtrace.googleapis.com/mcp" in urls

    def test_build_mcp_urls_ignores_identity_data(self) -> None:
        assert self.provider.build_mcp_urls({"some_key": "some_value"}) == list(GCP_MCP_URLS)


class GCPTestProvider(DummyProvider):
    name = "GCP Test"
    key = "gcp-test"

    def get_pipeline_views(self):
        return [
            GCPOAuth2LoginView(
                authorize_url=AUTHORIZE_URL,
                client_id="test-client-id",
                scope="openid email",
            ),
            OAuth2CallbackView(
                access_token_url=TOKEN_URL,
                client_id="test-client-id",
                client_secret="test-client-secret",
            ),
        ]

    def build_identity(self, state):
        return {"id": "test", "data": state.get("data", {})}


@control_silo_test
@patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
class GCPPipelineIntegrationTest(TestCase):
    def setUp(self) -> None:
        sentry.identity.register(GCPTestProvider)
        super().setUp()
        self.request = self._make_request()
        self.identity_provider = IdentityProvider.objects.create(type="gcp-test")

    def tearDown(self) -> None:
        super().tearDown()
        sentry.identity.unregister(GCPTestProvider)

    def _make_request(self, **query_params):
        request = RequestFactory().get("/", data=query_params)
        request.session = SessionBase()
        request.user = self.user
        request.subdomain = None
        setattr(request, "_messages", FallbackStorage(request))
        return request

    @responses.activate
    def test_full_pipeline(self, _mock_record: MagicMock) -> None:
        id_token = _make_id_token(
            {"sub": "gcp-user-456", "email": "test@example.com", "name": "Test"}
        )
        responses.add(
            responses.POST,
            TOKEN_URL,
            json={
                "access_token": "final-token",
                "token_type": "Bearer",
                "id_token": id_token,
                "refresh_token": "refresh-abc",
                "expires_in": 3600,
            },
        )

        pipeline = IdentityPipeline(
            request=self.request,
            provider_key="gcp-test",
            provider_model=self.identity_provider,
        )
        pipeline.initialize()

        # Login view: redirects to Google authorize URL
        response_redirect = pipeline.current_step()

        assert response_redirect.status_code == 302
        query = parse_qs(urlparse(response_redirect["Location"]).query)
        assert query["client_id"] == ["test-client-id"]
        assert query["access_type"] == ["offline"]
        assert query["prompt"] == ["consent"]

        # Callback view: simulate OAuth redirect back with code
        oauth_state = pipeline.fetch_state("state")
        pipeline.request = self._make_request(code="auth-code", state=oauth_state)
        result = pipeline.current_step()

        assert result.status_code == 302

        # Verify the token exchange request
        exchange_request = responses.calls[0].request
        data = dict(parse_qsl(exchange_request.body))
        assert data["grant_type"] == "authorization_code"
        assert data["code"] == "auth-code"
        assert data["client_id"] == "test-client-id"
        assert data["client_secret"] == "test-client-secret"
