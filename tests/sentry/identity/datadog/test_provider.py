from __future__ import annotations

import base64
import hashlib
from functools import cached_property
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, parse_qsl, urlparse

import responses
from django.contrib.messages.storage.fallback import FallbackStorage
from django.contrib.sessions.backends.base import SessionBase
from django.test import Client, RequestFactory

import sentry.identity
from sentry.identity.datadog.provider import (
    DatadogDCRView,
    DatadogOAuth2CallbackView,
    DatadogOAuth2LoginView,
    MissingPipelineStateError,
)
from sentry.identity.pipeline import IdentityPipeline
from sentry.identity.providers.dummy import DummyProvider
from sentry.testutils.asserts import assert_failure_metric
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.identity import IdentityProvider


@control_silo_test
class DatadogOAuth2LoginViewTest(TestCase):
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
        return DatadogOAuth2LoginView(
            authorize_url="https://example.org/oauth2/authorize",
            scope="read",
            resource="https://mcp.datadoghq.com",
        )

    def _make_pipeline(self, dcr_client_id: str = "dcr-client-123") -> IdentityPipeline:
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        pipeline.initialize()
        pipeline.bind_state("dcr_client_id", dcr_client_id)
        return pipeline

    def test_includes_pkce_params(self) -> None:
        pipeline = self._make_pipeline()
        response = self.view.dispatch(self.request, pipeline)

        assert response.status_code == 302
        query = parse_qs(urlparse(response["Location"]).query)

        assert query["code_challenge_method"] == ["S256"]
        assert "code_challenge" in query
        assert len(query["code_challenge"][0]) > 0

    def test_includes_resource(self) -> None:
        pipeline = self._make_pipeline()
        response = self.view.dispatch(self.request, pipeline)

        query = parse_qs(urlparse(response["Location"]).query)
        assert query["resource"] == ["https://mcp.datadoghq.com"]

    def test_reads_client_id_from_pipeline_state(self) -> None:
        pipeline = self._make_pipeline(dcr_client_id="my-dcr-id")
        response = self.view.dispatch(self.request, pipeline)

        query = parse_qs(urlparse(response["Location"]).query)
        assert query["client_id"] == ["my-dcr-id"]

    def test_binds_code_verifier_to_pipeline(self) -> None:
        pipeline = self._make_pipeline()
        assert pipeline.fetch_state("pkce_code_verifier") is None

        self.view.dispatch(self.request, pipeline)

        verifier = pipeline.fetch_state("pkce_code_verifier")
        assert verifier is not None
        assert len(verifier) > 0

    def test_preserves_existing_code_verifier(self) -> None:
        pipeline = self._make_pipeline()
        pipeline.bind_state("pkce_code_verifier", "existing-verifier")

        self.view.dispatch(self.request, pipeline)

        assert pipeline.fetch_state("pkce_code_verifier") == "existing-verifier"

    def test_preserves_standard_oauth_params(self) -> None:
        pipeline = self._make_pipeline()
        response = self.view.dispatch(self.request, pipeline)

        query = parse_qs(urlparse(response["Location"]).query)
        assert query["client_id"] == ["dcr-client-123"]
        assert query["response_type"] == ["code"]
        assert query["scope"] == ["read"]
        assert "state" in query


@control_silo_test
@patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
class DatadogOAuth2CallbackViewTest(TestCase):
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
        )

    def _make_pipeline(
        self,
        code_verifier: str | None = None,
        dcr_client_id: str = "dcr-client",
        dcr_client_secret: str = "dcr-secret",
    ) -> IdentityPipeline:
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        pipeline.initialize()
        pipeline.bind_state("dcr_client_id", dcr_client_id)
        pipeline.bind_state("dcr_client_secret", dcr_client_secret)
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
        assert auth_header == f"Basic {base64.b64encode(b'dcr-client:dcr-secret').decode()}"

    def test_exchange_token_no_code_verifier(self, mock_record: MagicMock) -> None:
        pipeline = self._make_pipeline()

        result = self.view.exchange_token(self.request, pipeline, "auth-code")
        assert result["error"] == "Missing pipeline state"
        assert "error_description" in result

        assert_failure_metric(
            mock_record, MissingPipelineStateError("PKCE code_verifier missing from pipeline state")
        )

    def test_exchange_token_no_dcr_credentials(self, mock_record: MagicMock) -> None:
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        pipeline.initialize()
        pipeline.bind_state("pkce_code_verifier", "some-verifier")

        result = self.view.exchange_token(self.request, pipeline, "auth-code")
        assert result["error"] == "Missing pipeline state"
        assert "error_description" in result

        assert_failure_metric(
            mock_record, MissingPipelineStateError("DCR credentials missing from pipeline state")
        )


class DatadogTestProvider(DummyProvider):
    name = "Datadog Test"
    key = "datadog-test"

    REGISTER_URL = "https://mcp.datadoghq.com/api/unstable/mcp-server/register"
    AUTHORIZE_URL = "https://mcp.datadoghq.com/api/unstable/mcp-server/authorize"
    TOKEN_URL = "https://mcp.datadoghq.com/api/unstable/mcp-server/token"
    RESOURCE = "https://mcp.datadoghq.com"

    def get_pipeline_views(self):
        return [
            DatadogDCRView(register_url=self.REGISTER_URL),
            DatadogOAuth2LoginView(
                authorize_url=self.AUTHORIZE_URL, scope="read", resource=self.RESOURCE
            ),
            DatadogOAuth2CallbackView(access_token_url=self.TOKEN_URL),
        ]

    def build_identity(self, state):
        return {"id": "test", "data": state.get("data", {})}


@control_silo_test
@patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
class DatadogOAuthPipelineIntegrationTest(TestCase):
    """Integration test covering the full DCR -> Login -> Callback flow."""

    def setUp(self) -> None:
        sentry.identity.register(DatadogTestProvider)
        super().setUp()
        self.request = self._make_request()
        self.identity_provider = IdentityProvider.objects.create(type="datadog-test")

    def tearDown(self) -> None:
        super().tearDown()
        sentry.identity.unregister(DatadogTestProvider)

    def _make_request(self, **query_params):
        request = RequestFactory().get("/", data=query_params)
        request.session = SessionBase()
        request.user = self.user
        request.subdomain = None
        setattr(request, "_messages", FallbackStorage(request))
        return request

    @responses.activate
    def test_pipeline_views(self, mock_record: MagicMock) -> None:
        responses.add(
            responses.POST,
            DatadogTestProvider.REGISTER_URL,
            json={"client_id": "dcr-client-id", "client_secret": "dcr-client-secret"},
        )
        responses.add(
            responses.POST,
            DatadogTestProvider.TOKEN_URL,
            json={"access_token": "final-token", "token_type": "Bearer"},
        )

        pipeline = IdentityPipeline(
            request=self.request, provider_key="datadog-test", provider_model=self.identity_provider
        )
        pipeline.initialize()

        # DCR + Login views: DCR binds client credentials, proceeds to Login.
        # Login generates PKCE and returns a redirect, which stops the chain.
        response_redirect = pipeline.current_step()

        assert pipeline.fetch_state("dcr_client_id") == "dcr-client-id"
        assert pipeline.fetch_state("dcr_client_secret") == "dcr-client-secret"

        query = parse_qs(urlparse(response_redirect["Location"]).query)
        assert query["client_id"] == ["dcr-client-id"]
        assert query["resource"] == [DatadogTestProvider.RESOURCE]
        assert "code_challenge" in query
        code_challenge = query["code_challenge"][0]
        assert query["code_challenge_method"] == ["S256"]

        # Login + Callback views: Simulate the OAuth redirect and advance to Callback.
        oauth_state = pipeline.fetch_state("state")
        pipeline.request = self._make_request(code="auth-code", state=oauth_state)
        result = pipeline.current_step()

        # Pipeline completed successfully with a redirect.
        assert result.status_code == 302

        exchange_token_request = responses.calls[1].request
        data = dict(parse_qsl(exchange_token_request.body))

        code_verifier = data["code_verifier"]
        expected_code_challenge = (
            base64.urlsafe_b64encode(hashlib.sha256(code_verifier.encode("ascii")).digest())
            .rstrip(b"=")
            .decode("ascii")
        )
        assert code_challenge == expected_code_challenge

        # Ensure client id and secret were included in the auth header.
        assert "client_id" not in data
        assert "client_secret" not in data
        expected_auth_header = (
            f"Basic {base64.b64encode(b'dcr-client-id:dcr-client-secret').decode()}"
        )
        assert exchange_token_request.headers["Authorization"] == expected_auth_header
