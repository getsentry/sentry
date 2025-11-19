import json
from collections import namedtuple
from functools import cached_property
from unittest import TestCase
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, parse_qsl, urlparse

import responses
from django.http import HttpResponse
from django.test import Client, RequestFactory
from requests.exceptions import SSLError

import sentry.identity
from sentry.identity.oauth2 import ERR_INVALID_STATE, OAuth2CallbackView, OAuth2LoginView
from sentry.identity.pipeline import IdentityPipeline
from sentry.identity.providers.dummy import DummyProvider
from sentry.integrations.types import EventLifecycleOutcome
from sentry.shared_integrations.exceptions import ApiUnauthorized
from sentry.testutils.asserts import assert_failure_metric, assert_slo_metric
from sentry.testutils.silo import control_silo_test

MockResponse = namedtuple("MockResponse", ["headers", "content"])


@control_silo_test
@patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
class OAuth2CallbackViewTest(TestCase):
    def setUp(self) -> None:
        sentry.identity.register(DummyProvider)
        super().setUp()
        self.request = RequestFactory().get("/")
        self.request.subdomain = None

    def tearDown(self) -> None:
        super().tearDown()
        sentry.identity.unregister(DummyProvider)

    @cached_property
    def view(self):
        return OAuth2CallbackView(
            access_token_url="https://example.org/oauth/token",
            client_id=123456,
            client_secret="secret-value",
        )

    @responses.activate
    def test_exchange_token_success(self, mock_record: MagicMock) -> None:
        responses.add(
            responses.POST, "https://example.org/oauth/token", json={"token": "a-fake-token"}
        )

        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        code = "auth-code"
        result = self.view.exchange_token(self.request, pipeline, code)
        assert "token" in result
        assert "a-fake-token" == result["token"]

        assert len(responses.calls) == 1
        assert responses.calls[0].request.url == "https://example.org/oauth/token"
        data = dict(parse_qsl(responses.calls[0].request.body))
        assert data == {
            "client_id": "123456",
            "client_secret": "secret-value",
            "code": "auth-code",
            "grant_type": "authorization_code",
            "redirect_uri": "http://testserver/extensions/default/setup/",
        }

        assert_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)

    @responses.activate
    def test_exchange_token_success_customer_domains(self, mock_record: MagicMock) -> None:
        responses.add(
            responses.POST, "https://example.org/oauth/token", json={"token": "a-fake-token"}
        )
        self.request.subdomain = "albertos-apples"
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        code = "auth-code"
        result = self.view.exchange_token(self.request, pipeline, code)
        assert "token" in result
        assert "a-fake-token" == result["token"]

        assert len(responses.calls) == 1
        assert responses.calls[0].request.url == "https://example.org/oauth/token"
        data = dict(parse_qsl(responses.calls[0].request.body))
        assert data == {
            "client_id": "123456",
            "client_secret": "secret-value",
            "code": "auth-code",
            "grant_type": "authorization_code",
            "redirect_uri": "http://testserver/extensions/default/setup/",
        }

        assert_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)

    @responses.activate
    def test_exchange_token_ssl_error(self, mock_record: MagicMock) -> None:
        def ssl_error(request):
            raise SSLError("Could not build connection")

        responses.add_callback(
            responses.POST, "https://example.org/oauth/token", callback=ssl_error
        )
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        code = "auth-code"
        result = self.view.exchange_token(self.request, pipeline, code)
        assert "token" not in result
        assert "error" in result
        assert "error_description" in result
        assert "SSL" in result["error_description"]

        assert_failure_metric(mock_record, "ssl_error")

    @responses.activate
    def test_connection_error(self, mock_record: MagicMock) -> None:
        def connection_error(request):
            raise ConnectionError("Name or service not known")

        responses.add_callback(
            responses.POST, "https://example.org/oauth/token", callback=connection_error
        )
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        code = "auth-code"
        result = self.view.exchange_token(self.request, pipeline, code)
        assert "token" not in result
        assert "error" in result
        assert "connect" in result["error"]
        assert "error_description" in result

        assert_failure_metric(mock_record, "connection_error")

    @responses.activate
    def test_exchange_token_no_json(self, mock_record: MagicMock) -> None:
        responses.add(responses.POST, "https://example.org/oauth/token", body="")
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        code = "auth-code"
        result = self.view.exchange_token(self.request, pipeline, code)
        assert "token" not in result
        assert "error" in result
        assert "error_description" in result
        assert "JSON" in result["error_description"]

        assert_failure_metric(mock_record, "json_error")

    @responses.activate
    def test_api_error(self, mock_record: MagicMock) -> None:
        responses.add(
            responses.POST,
            "https://example.org/oauth/token",
            json={"token": "a-fake-token"},
            status=401,
        )
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        code = "auth-code"
        result = self.view.exchange_token(self.request, pipeline, code)
        assert "token" not in result
        assert "error" in result
        assert "401" in result["error"]

        assert_failure_metric(mock_record, ApiUnauthorized('{"token": "a-fake-token"}'))

    @patch("sentry.integrations.utils.metrics.IntegrationEventLifecycle.record_failure")
    def test_state_mismatch_sanitizes_logged_value(
        self,
        mock_record_failure: MagicMock,
        mock_record_event: MagicMock,
    ) -> None:
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        pipeline.bind_state("state", "59bd69f591011a0cb6b64e0c0d271731")

        malicious_state = "1-1); waitfor delay '0:0:15' --"
        request = RequestFactory().get("/", {"state": malicious_state, "code": "auth-code"})
        request.subdomain = None

        with patch.object(
            IdentityPipeline, "error", return_value=HttpResponse("error")
        ) as mock_error:
            self.view.dispatch(request, pipeline)

        mock_error.assert_called_once()
        _, message = mock_error.call_args.args
        assert message == ERR_INVALID_STATE

        mock_record_failure.assert_called_once()
        extra = mock_record_failure.call_args.kwargs["extra"]
        assert extra["error"] == "invalid_state"
        serialized_extra = json.dumps(extra)
        assert "waitfor delay" not in serialized_extra
        assert "auth-code" not in serialized_extra
        assert extra["provided_state_present"] is True
        assert extra["expected_state_present"] is True
        assert extra["provided_state_matches_expected_format"] is False
        assert extra["expected_state_matches_expected_format"] is True
        assert "provided_state_sha256" in extra
        assert "expected_state_sha256" in extra

    @patch("sentry.integrations.utils.metrics.IntegrationEventLifecycle.record_failure")
    def test_provider_error_is_redacted_when_invalid(
        self,
        mock_record_failure: MagicMock,
        mock_record_event: MagicMock,
    ) -> None:
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        request = RequestFactory().get("/", {"error": "1-1); waitfor delay '0:0:15' --"})
        request.subdomain = None

        with patch.object(
            IdentityPipeline, "error", return_value=HttpResponse("error")
        ) as mock_error:
            self.view.dispatch(request, pipeline)

        mock_error.assert_called_once()
        _, message = mock_error.call_args.args
        assert message == ERR_INVALID_STATE

        mock_record_failure.assert_called_once()
        extra = mock_record_failure.call_args.kwargs["extra"]
        assert extra["error"] == "provider_error_redacted"
        serialized_extra = json.dumps(extra)
        assert "waitfor delay" not in serialized_extra
        assert extra["provider_error_present"] is True
        assert "provider_error_sha256" in extra

    @patch("sentry.integrations.utils.metrics.IntegrationEventLifecycle.record_failure")
    def test_provider_error_keeps_safe_message(
        self,
        mock_record_failure: MagicMock,
        mock_record_event: MagicMock,
    ) -> None:
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        request = RequestFactory().get("/", {"error": "access_denied"})
        request.subdomain = None

        with patch.object(
            IdentityPipeline, "error", return_value=HttpResponse("error")
        ) as mock_error:
            self.view.dispatch(request, pipeline)

        mock_error.assert_called_once()
        _, message = mock_error.call_args.args
        assert message == f"{ERR_INVALID_STATE}\nError: access_denied"

        mock_record_failure.assert_called_once()
        extra = mock_record_failure.call_args.kwargs["extra"]
        assert extra["error"] == "access_denied"
        assert extra["provider_error_present"] is True
        assert "provider_error_sha256" in extra


@control_silo_test
class OAuth2LoginViewTest(TestCase):
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
        return OAuth2LoginView(
            authorize_url="https://example.org/oauth2/authorize",
            client_id=123456,
            scope="all-the-things",
        )

    def test_simple(self) -> None:
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        response = self.view.dispatch(self.request, pipeline)

        assert response.status_code == 302
        assert response["Location"].startswith("https://example.org/oauth2/authorize")
        redirect_url = urlparse(response["Location"])
        query = parse_qs(redirect_url.query)

        assert query["client_id"][0] == "123456"
        assert query["redirect_uri"][0] == "http://testserver/extensions/default/setup/"
        assert query["response_type"][0] == "code"
        assert query["scope"][0] == "all-the-things"
        assert "state" in query

    def test_customer_domains(self) -> None:
        self.request.subdomain = "albertos-apples"
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        response = self.view.dispatch(self.request, pipeline)

        assert response.status_code == 302
        assert response["Location"].startswith("https://example.org/oauth2/authorize")
        redirect_url = urlparse(response["Location"])
        query = parse_qs(redirect_url.query)

        assert query["client_id"][0] == "123456"
        assert query["redirect_uri"][0] == "http://testserver/extensions/default/setup/"
        assert query["response_type"][0] == "code"
        assert query["scope"][0] == "all-the-things"
        assert "state" in query
