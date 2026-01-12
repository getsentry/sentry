from collections import namedtuple
from functools import cached_property
from unittest import TestCase
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, parse_qsl, urlparse

import responses
from django.test import Client, RequestFactory
from requests.exceptions import SSLError

import sentry.identity
from sentry.identity.oauth2 import OAuth2CallbackView, OAuth2LoginView, sanitize_error_message
from sentry.identity.pipeline import IdentityPipeline
from sentry.identity.providers.dummy import DummyProvider
from sentry.integrations.types import EventLifecycleOutcome
from sentry.shared_integrations.exceptions import ApiUnauthorized
from sentry.testutils.asserts import assert_failure_metric, assert_slo_metric
from sentry.testutils.silo import control_silo_test

MockResponse = namedtuple("MockResponse", ["headers", "content"])


class SanitizeErrorMessageTest(TestCase):
    def test_sanitize_normal_error(self) -> None:
        """Test that normal error messages pass through unchanged."""
        error = "access_denied"
        assert sanitize_error_message(error) == "access_denied"

    def test_sanitize_empty_error(self) -> None:
        """Test that empty errors are handled gracefully."""
        assert sanitize_error_message("") == ""
        assert sanitize_error_message(None) == ""

    def test_sanitize_removes_control_characters(self) -> None:
        """Test that control characters are removed."""
        error = "error\x00with\x01control\x1fchars"
        sanitized = sanitize_error_message(error)
        assert "\x00" not in sanitized
        assert "\x01" not in sanitized
        assert "\x1f" not in sanitized
        assert "errorwithcontrolchars" == sanitized

    def test_sanitize_removes_newlines(self) -> None:
        """Test that newlines are removed to prevent log injection."""
        error = "error\nwith\nnewlines"
        sanitized = sanitize_error_message(error)
        assert "\n" not in sanitized
        assert "errorwithnewlines" == sanitized

    def test_sanitize_removes_command_injection(self) -> None:
        """Test that command injection attempts are sanitized."""
        error = "&nslookup -q=cname test.bxss.me&'\"` 0&nslookup -q=cname test.bxss.me&`'"
        sanitized = sanitize_error_message(error)
        # The string should be preserved but without control characters
        assert "nslookup" in sanitized
        assert "\x00" not in sanitized

    def test_sanitize_truncates_long_errors(self) -> None:
        """Test that overly long error messages are truncated."""
        error = "a" * 300
        sanitized = sanitize_error_message(error)
        assert len(sanitized) <= 203  # 200 + "..."
        assert sanitized.endswith("...")

    def test_sanitize_preserves_unicode(self) -> None:
        """Test that unicode characters are preserved."""
        error = "Error: 用户被拒绝访问"
        sanitized = sanitize_error_message(error)
        assert "用户被拒绝访问" in sanitized

    def test_sanitize_removes_ansi_escapes(self) -> None:
        """Test that ANSI escape sequences are removed."""
        error = "\x1b[31mRed Error\x1b[0m"
        sanitized = sanitize_error_message(error)
        assert "\x1b" not in sanitized
        assert "Red Error" in sanitized


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

    @patch("sentry.identity.oauth2.sanitize_error_message")
    def test_oauth_callback_error_sanitized(
        self, mock_sanitize: MagicMock, mock_record: MagicMock
    ) -> None:
        """Test that OAuth callback errors are sanitized before processing."""
        malicious_error = "&nslookup -q=cname test.bxss.me&'\"` 0&nslookup -q=cname test.bxss.me&`'"
        mock_sanitize.return_value = "sanitized_error"

        request = RequestFactory().get("/?error=" + malicious_error)
        request.subdomain = None
        request.session = Client().session

        pipeline = IdentityPipeline(request=request, provider_key="dummy")
        pipeline.initialize()

        response = self.view.dispatch(request, pipeline)

        # Verify sanitize was called with the malicious error
        mock_sanitize.assert_called_once_with(malicious_error)

        # Verify the response uses the sanitized error
        assert response.status_code == 200
        assert b"sanitized_error" in response.content

    def test_oauth_callback_malicious_error_integration(
        self, mock_record: MagicMock
    ) -> None:
        """Integration test that malicious errors are properly sanitized."""
        malicious_error = "&nslookup\x00 -q=cname\ntest.bxss.me&"

        request = RequestFactory().get("/?error=" + malicious_error)
        request.subdomain = None
        request.session = Client().session

        pipeline = IdentityPipeline(request=request, provider_key="dummy")
        pipeline.initialize()

        response = self.view.dispatch(request, pipeline)

        # Verify control characters are removed
        assert b"\x00" not in response.content
        assert b"\n" not in response.content.split(b"<pre>")[1].split(b"</pre>")[0]


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

