from collections import namedtuple
from functools import cached_property
from unittest import TestCase
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, parse_qsl, urlparse

import responses
from django.test import Client, RequestFactory
from requests.exceptions import SSLError

import sentry.identity
from sentry.identity.oauth2 import OAuth2CallbackView, OAuth2LoginView
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
@patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
class OAuth2CallbackViewSecurityTest(TestCase):
    """Tests for security vulnerabilities in OAuth2CallbackView"""

    def setUp(self) -> None:
        sentry.identity.register(DummyProvider)
        super().setUp()
        self.request = RequestFactory().get("/")
        self.request.subdomain = None
        self.request.session = Client().session

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

    def test_sanitizes_sql_injection_in_error_parameter(self, mock_record: MagicMock) -> None:
        """Test that SQL injection payloads in error parameter are sanitized"""
        sql_injection = '-1" OR 5*5=26 -- '
        self.request = RequestFactory().get("/", {"error": sql_injection})
        self.request.subdomain = None
        self.request.session = Client().session

        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        response = self.view.dispatch(self.request, pipeline)

        # The error should be sanitized - double quotes should be removed
        assert response.status_code == 200
        # Check that SQL injection characters are removed
        assert '"' not in response.content.decode()
        assert 'OR' in response.content.decode()  # Should still have OR (allowed chars)
        assert '--' not in response.content.decode()  # SQL comment should be removed

    def test_sanitizes_xss_in_error_parameter(self, mock_record: MagicMock) -> None:
        """Test that XSS payloads in error parameter are sanitized"""
        xss_payload = '<script>alert("XSS")</script>'
        self.request = RequestFactory().get("/", {"error": xss_payload})
        self.request.subdomain = None
        self.request.session = Client().session

        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        response = self.view.dispatch(self.request, pipeline)

        # The error should be sanitized - HTML tags should be removed
        assert response.status_code == 200
        content = response.content.decode()
        assert '<script>' not in content
        assert 'alert' in content  # Text content should remain
        assert '"' not in content  # Quotes should be removed

    def test_sanitizes_command_injection_in_error_parameter(self, mock_record: MagicMock) -> None:
        """Test that command injection payloads in error parameter are sanitized"""
        command_injection = "; rm -rf /; echo 'pwned'"
        self.request = RequestFactory().get("/", {"error": command_injection})
        self.request.subdomain = None
        self.request.session = Client().session

        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        response = self.view.dispatch(self.request, pipeline)

        # The error should be sanitized - dangerous characters should be removed
        assert response.status_code == 200
        content = response.content.decode()
        assert '/' not in content  # Slashes should be removed
        assert "'" not in content  # Single quotes should be removed

    def test_limits_error_parameter_length(self, mock_record: MagicMock) -> None:
        """Test that excessively long error parameters are truncated"""
        long_error = "A" * 1000
        self.request = RequestFactory().get("/", {"error": long_error})
        self.request.subdomain = None
        self.request.session = Client().session

        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        response = self.view.dispatch(self.request, pipeline)

        # The error should be truncated to 200 characters max
        assert response.status_code == 200
        content = response.content.decode()
        # Count actual A's in the response - should be limited
        a_count = content.count('A')
        assert a_count <= 200, f"Expected at most 200 A's, found {a_count}"

    def test_allows_safe_error_messages(self, mock_record: MagicMock) -> None:
        """Test that legitimate error messages with safe characters are preserved"""
        safe_error = "access_denied: User cancelled authorization."
        self.request = RequestFactory().get("/", {"error": safe_error})
        self.request.subdomain = None
        self.request.session = Client().session

        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        response = self.view.dispatch(self.request, pipeline)

        assert response.status_code == 200
        content = response.content.decode()
        # Safe characters should be preserved
        assert "access" in content
        assert "denied" in content
        assert "User" in content
        assert "cancelled" in content
        assert "authorization" in content

    @responses.activate
    def test_sanitizes_error_from_token_exchange(self, mock_record: MagicMock) -> None:
        """Test that errors from token exchange responses are sanitized"""
        # Mock a token exchange that returns an error with malicious content
        responses.add(
            responses.POST,
            "https://example.org/oauth/token",
            json={"error": '<script>alert("XSS")</script>', "error_description": '"; DROP TABLE users; --'},
            status=200,
        )

        self.request = RequestFactory().get("/", {"code": "test-code", "state": "test-state"})
        self.request.subdomain = None
        self.request.session = Client().session

        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        pipeline.bind_state("state", "test-state")
        response = self.view.dispatch(self.request, pipeline)

        # The errors should be sanitized
        assert response.status_code == 200
        content = response.content.decode()
        assert '<script>' not in content
        assert 'DROP' in content  # Text should remain
        assert 'TABLE' in content
        assert '"' not in content  # Quotes removed
        assert '--' not in content  # SQL comment removed


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
