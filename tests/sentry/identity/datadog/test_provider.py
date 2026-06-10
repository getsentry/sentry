from __future__ import annotations

import base64
import hashlib
from functools import cached_property
from typing import Any
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, parse_qsl, urlparse

import orjson
import pytest
import responses
from django.contrib.messages.storage.fallback import FallbackStorage
from django.contrib.sessions.backends.base import SessionBase
from django.test import Client, RequestFactory
from requests import ConnectionError, HTTPError
from requests.exceptions import SSLError

import sentry.identity
from sentry.auth.exceptions import IdentityNotValid
from sentry.identity.datadog.provider import (
    DatadogIdentityProvider,
    DatadogOAuth2CallbackView,
    DatadogOAuth2DCRView,
    DatadogOAuth2LoginView,
    MissingPipelineStateError,
)
from sentry.identity.pipeline import IdentityPipeline
from sentry.identity.providers.dummy import DummyProvider
from sentry.testutils.asserts import assert_failure_metric
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.identity import Identity, IdentityProvider

REGISTER_URL = "https://mcp.datadoghq.com/api/unstable/mcp-server/register"
AUTHORIZE_URL = "https://mcp.datadoghq.com/api/unstable/mcp-server/authorize"
TOKEN_URL = "https://mcp.datadoghq.com/api/unstable/mcp-server/token"
RESOURCE = "https://mcp.datadoghq.com"


@control_silo_test
@patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
class DatadogOAuth2DCRViewTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.request = RequestFactory().get("/")
        self.pipeline = MagicMock()
        self.pipeline.config = {}
        self.pipeline.provider.key = "datadog"
        self.pipeline.fetch_state.return_value = None
        self.view = DatadogOAuth2DCRView(register_url=REGISTER_URL)

    @responses.activate
    def test_binds_client_credentials(self, mock_record: MagicMock) -> None:
        responses.add(
            responses.POST,
            REGISTER_URL,
            json={"client_id": "new-client-id", "client_secret": "new-client-secret"},
        )

        self.view.dispatch(self.request, self.pipeline)

        assert len(responses.calls) == 1
        body = orjson.loads(responses.calls[0].request.body)
        assert body["client_name"] == "sentry"
        assert body["grant_types"] == ["authorization_code", "refresh_token"]
        assert body["token_endpoint_auth_method"] == "client_secret_basic"
        assert len(body["redirect_uris"]) == 1

        self.pipeline.bind_state.assert_any_call("dcr_client_id", "new-client-id")
        self.pipeline.bind_state.assert_any_call("dcr_client_secret", "new-client-secret")

    @responses.activate
    def test_skips_registration_when_client_credentials_exist(self, mock_record: MagicMock) -> None:
        self.pipeline.fetch_state.return_value = "existing"

        self.view.dispatch(self.request, self.pipeline)

        assert len(responses.calls) == 0
        self.pipeline.next_step.assert_called_once()

    @responses.activate
    def test_http_error(self, mock_record: MagicMock) -> None:
        responses.add(responses.POST, REGISTER_URL, status=429)

        self.view.dispatch(self.request, self.pipeline)

        self.pipeline.error.assert_called_once_with("DCR registration failed")
        self.pipeline.bind_state.assert_not_called()
        assert_failure_metric(mock_record, HTTPError())

    @patch("sentry.identity.datadog.provider.safe_urlopen", side_effect=SSLError())
    def test_ssl_error(self, mock_urlopen: MagicMock, mock_record: MagicMock) -> None:
        self.view.dispatch(self.request, self.pipeline)

        self.pipeline.error.assert_called_once_with("Could not verify SSL certificate")
        self.pipeline.bind_state.assert_not_called()
        assert_failure_metric(mock_record, "ssl_error")

    @patch("sentry.identity.datadog.provider.safe_urlopen", side_effect=ConnectionError())
    def test_connection_error(self, mock_urlopen: MagicMock, mock_record: MagicMock) -> None:
        self.view.dispatch(self.request, self.pipeline)

        self.pipeline.error.assert_called_once_with("Could not connect to host or service")
        self.pipeline.bind_state.assert_not_called()
        assert_failure_metric(mock_record, "connection_error")

    @responses.activate
    def test_invalid_json(self, mock_record: MagicMock) -> None:
        responses.add(responses.POST, REGISTER_URL, body="not json", status=200)

        self.view.dispatch(self.request, self.pipeline)

        self.pipeline.error.assert_called_once_with("Could not decode a JSON Response")
        self.pipeline.bind_state.assert_not_called()
        assert_failure_metric(mock_record, "json_error")

    @responses.activate
    def test_missing_credentials(self, mock_record: MagicMock) -> None:
        responses.add(responses.POST, REGISTER_URL, json={"client_id": "id-only"})

        self.view.dispatch(self.request, self.pipeline)

        self.pipeline.error.assert_called_once_with("DCR response missing client credentials")
        self.pipeline.bind_state.assert_not_called()
        assert_failure_metric(mock_record, "missing_credentials")


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
        return DatadogOAuth2LoginView(authorize_url=AUTHORIZE_URL, scope="read", resource=RESOURCE)

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
        assert query["resource"] == [RESOURCE]

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

    def test_does_not_overwrite_code_verifier_on_callback(self) -> None:
        pipeline = self._make_pipeline()

        # First pass: generates verifier and redirects.
        self.view.dispatch(self.request, pipeline)
        original_verifier = pipeline.fetch_state("pkce_code_verifier")
        assert original_verifier is not None

        # Second pass: callback with code in GET params.
        callback_request = RequestFactory().get("/", data={"code": "auth-code", "state": "s"})
        callback_request.session = Client().session
        callback_request.user = self.user
        callback_request.subdomain = None
        with patch.object(pipeline, "next_step"):
            self.view.dispatch(callback_request, pipeline)

        assert pipeline.fetch_state("pkce_code_verifier") == original_verifier

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
        return DatadogOAuth2CallbackView(access_token_url=TOKEN_URL)

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
        responses.add(responses.POST, TOKEN_URL, json={"access_token": "pkce-token"})
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

    def get_pipeline_views(self):
        return [
            DatadogOAuth2DCRView(register_url=REGISTER_URL),
            DatadogOAuth2LoginView(authorize_url=AUTHORIZE_URL, scope="read", resource=RESOURCE),
            DatadogOAuth2CallbackView(access_token_url=TOKEN_URL),
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
            REGISTER_URL,
            json={"client_id": "dcr-client-id", "client_secret": "dcr-client-secret"},
        )
        responses.add(
            responses.POST,
            TOKEN_URL,
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
        assert query["resource"] == [RESOURCE]
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


@control_silo_test
class DatadogIdentityProviderTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.provider = DatadogIdentityProvider()
        self.provider.config = {"site": "datadoghq.com"}
        self.identity_provider = IdentityProvider.objects.create(type="datadog")

    @patch("sentry.identity.datadog.provider.get_user_info")
    def test_build_identity(self, mock_get_user_info: MagicMock) -> None:
        mock_get_user_info.return_value = {
            "id": "dd-user-123",
            "attributes": {"email": "user@example.com", "name": "Test User"},
        }

        result = self.provider.build_identity(
            {
                "data": {
                    "access_token": "token-abc",
                    "refresh_token": "refresh-xyz",
                    "expires_in": 3600,
                    "token_type": "Bearer",
                    "scope": "apm_read",
                },
                "dcr_client_id": "dcr-client-id",
                "dcr_client_secret": "dcr-client-secret",
            }
        )

        assert result["id"] == "dd-user-123"
        assert result["email"] == "user@example.com"
        assert result["name"] == "Test User"
        assert result["type"] == "datadog"
        assert result["data"]["access_token"] == "token-abc"
        assert result["data"]["refresh_token"] == "refresh-xyz"
        assert "expires" in result["data"]
        assert result["data"]["token_type"] == "Bearer"
        assert result["data"]["scope"] == "apm_read"
        assert result["data"]["client_id"] == "dcr-client-id"
        assert result["data"]["client_secret"] == "dcr-client-secret"
        assert result["data"]["site"] == "datadoghq.com"
        mock_get_user_info.assert_called_once_with("token-abc", "datadoghq.com")

    @patch("sentry.identity.datadog.provider.get_user_info")
    def test_build_identity_missing_access_token(self, mock_get_user_info: MagicMock) -> None:
        with pytest.raises(ValueError, match="did not return an access_token"):
            self.provider.build_identity({"data": {}})
        mock_get_user_info.assert_not_called()

    @patch("sentry.identity.datadog.provider.get_user_info")
    def test_build_identity_missing_user_attributes(self, mock_get_user_info: MagicMock) -> None:
        mock_get_user_info.return_value = {"id": "dd-user-456", "attributes": {}}

        result = self.provider.build_identity({"data": {"access_token": "token"}})

        assert result["id"] == "dd-user-456"
        assert result["email"] is None
        assert result["name"] is None

    def _make_identity(self, **data_overrides: Any) -> Identity:
        data = {
            "access_token": "old-token",
            "refresh_token": "old-refresh",
            "client_id": "dcr-client-id",
            "client_secret": "dcr-client-secret",
            "site": "datadoghq.com",
        }
        data.update(data_overrides)
        return Identity.objects.create(
            idp=self.identity_provider, user=self.user, external_id="dd-user-123", data=data
        )

    @responses.activate
    def test_refresh_identity_success(self) -> None:
        responses.add(
            responses.POST,
            TOKEN_URL,
            json={"access_token": "new-token", "refresh_token": "new-refresh", "expires_in": 3600},
        )

        identity = self._make_identity()
        self.provider.refresh_identity(identity)

        auth_header = responses.calls[0].request.headers["Authorization"]
        assert (
            auth_header == f"Basic {base64.b64encode(b'dcr-client-id:dcr-client-secret').decode()}"
        )

        data = dict(parse_qsl(responses.calls[0].request.body))
        assert data["grant_type"] == "refresh_token"
        assert data["refresh_token"] == "old-refresh"
        assert "client_id" not in data
        assert "client_secret" not in data

        assert responses.calls[0].request.url == TOKEN_URL

        identity.refresh_from_db()
        assert identity.data["access_token"] == "new-token"
        assert identity.data["refresh_token"] == "new-refresh"

    def test_refresh_identity_missing_site(self) -> None:
        identity = self._make_identity(site=None)

        with pytest.raises(IdentityNotValid, match="Missing Datadog site"):
            self.provider.refresh_identity(identity)

    def test_refresh_identity_missing_dcr_credentials(self) -> None:
        identity = self._make_identity(client_id=None, client_secret=None)

        with pytest.raises(IdentityNotValid, match="Missing DCR credentials"):
            self.provider.refresh_identity(identity)

    def test_refresh_identity_missing_refresh_token(self) -> None:
        identity = self._make_identity(refresh_token=None)

        with pytest.raises(IdentityNotValid, match="Missing refresh token"):
            self.provider.refresh_identity(identity)
