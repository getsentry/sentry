from __future__ import annotations

import base64
import hashlib
from functools import cached_property
from unittest import TestCase
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, parse_qsl, urlparse

import responses
from django.contrib.sessions.backends.base import SessionBase
from django.test import Client, RequestFactory

import sentry.identity
from sentry.identity.datadog.provider import DatadogOAuth2CallbackView, DatadogOAuth2LoginView
from sentry.identity.pipeline import IdentityPipeline
from sentry.identity.providers.dummy import DummyProvider
from sentry.testutils.asserts import assert_failure_metric
from sentry.testutils.cases import TestCase as SentryTestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class DatadogOAuth2LoginViewTest(TestCase):
    def setUp(self) -> None:
        sentry.identity.register(DummyProvider)
        super().setUp()
        self.request = RequestFactory().get("/")
        self.request.session = Client().session
        self.request.subdomain = None

    def tearDown(self) -> None:
        super().tearDown()
        sentry.identity.unregister(DummyProvider)

    @cached_property
    def view(self):
        return DatadogOAuth2LoginView(
            authorize_url="https://example.org/oauth2/authorize", client_id=123456, scope="read"
        )

    def test_includes_pkce_params(self) -> None:
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        response = self.view.dispatch(self.request, pipeline)

        assert response.status_code == 302
        query = parse_qs(urlparse(response["Location"]).query)

        assert query["code_challenge_method"] == ["S256"]
        assert "code_challenge" in query
        assert len(query["code_challenge"][0]) > 0

    def test_preserves_standard_oauth_params(self) -> None:
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        response = self.view.dispatch(self.request, pipeline)

        query = parse_qs(urlparse(response["Location"]).query)
        assert query["client_id"] == ["123456"]
        assert query["response_type"] == ["code"]
        assert query["scope"] == ["read"]
        assert "state" in query


@control_silo_test
@patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
class DatadogOAuth2CallbackViewTest(SentryTestCase):
    def setUp(self) -> None:
        sentry.identity.register(DummyProvider)
        super().setUp()
        self.request = RequestFactory().get("/")
        self.request.session = SessionBase()
        self.request.user = self.user
        self.request.subdomain = None

    def tearDown(self) -> None:
        super().tearDown()
        sentry.identity.unregister(DummyProvider)

    @cached_property
    def view(self):
        return DatadogOAuth2CallbackView(
            access_token_url="https://example.org/oauth/token",
            client_id="pkce-client",
            client_secret="pkce-secret",
        )

    def _make_pipeline(self, code_verifier: str | None = None) -> IdentityPipeline:
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        pipeline.initialize()
        if code_verifier is not None:
            pipeline.bind_state("pkce_code_verifier", code_verifier)
        return pipeline

    @responses.activate
    def test_exchange_token_success(self, mock_record: MagicMock) -> None:
        responses.add(
            responses.POST,
            "https://example.org/oauth/token",
            json={"access_token": "pkce-token"},
        )
        pipeline = self._make_pipeline("test-verifier-abc")

        result = self.view.exchange_token(self.request, pipeline, "auth-code")

        assert result["access_token"] == "pkce-token"

        data = dict(parse_qsl(responses.calls[0].request.body))
        assert data["code_verifier"] == "test-verifier-abc"
        assert "client_id" not in data
        assert "client_secret" not in data

        auth_header = responses.calls[0].request.headers["Authorization"]
        assert auth_header == f"Basic {base64.b64encode(b'pkce-client:pkce-secret').decode()}"

    @responses.activate
    def test_exchange_token_no_code_verifier(self, mock_record: MagicMock) -> None:
        pipeline = self._make_pipeline()

        result = self.view.exchange_token(self.request, pipeline, "auth-code")
        assert result["error"] == "pkce_missing"
        assert "error_description" in result

        assert_failure_metric(
            mock_record, KeyError("PKCE code_verifier missing from pipeline state")
        )

    @responses.activate
    def test_login_to_callback_preserves_code_verifier(self, mock_record: MagicMock) -> None:
        responses.add(
            responses.POST,
            "https://example.org/oauth/token",
            json={"access_token": "pkce-token"},
        )

        login_view = DatadogOAuth2LoginView(
            authorize_url="https://example.org/oauth2/authorize",
            client_id="pkce-client",
            scope="read",
        )
        pipeline = self._make_pipeline()

        redirect_response = login_view.dispatch(self.request, pipeline)
        challenge_from_redirect = parse_qs(urlparse(redirect_response["Location"]).query)[
            "code_challenge"
        ][0]

        self.view.exchange_token(self.request, pipeline, "auth-code")

        verifier_sent = dict(parse_qsl(responses.calls[0].request.body))["code_verifier"]

        expected_challenge = (
            base64.urlsafe_b64encode(hashlib.sha256(verifier_sent.encode("ascii")).digest())
            .rstrip(b"=")
            .decode("ascii")
        )
        assert challenge_from_redirect == expected_challenge
