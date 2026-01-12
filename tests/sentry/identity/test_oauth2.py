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

    def test_parameter_pollution_with_state_only(self) -> None:
        """Test that injecting only a state parameter doesn't bypass state generation"""
        # Simulate an attacker injecting a malicious state parameter
        self.request = RequestFactory().get("/?state=malicious_state_value")
        self.request.session = Client().session
        self.request.subdomain = None
        
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        response = self.view.dispatch(self.request, pipeline)

        # Should still redirect to OAuth provider with newly generated state
        assert response.status_code == 302
        assert response["Location"].startswith("https://example.org/oauth2/authorize")
        redirect_url = urlparse(response["Location"])
        query = parse_qs(redirect_url.query)
        
        # Verify a new state was generated (not the malicious one)
        assert "state" in query
        assert query["state"][0] != "malicious_state_value"
        
        # Verify the state was stored in the pipeline
        stored_state = pipeline.fetch_state("state")
        assert stored_state is not None
        assert stored_state == query["state"][0]

    def test_parameter_pollution_with_code_and_state(self) -> None:
        """Test that injecting code+state parameters doesn't bypass state generation"""
        # Simulate an attacker injecting both code and state parameters
        malicious_state = "1yrphmgdpgulaszriylqiipemefmacafkxycjaxjs\x00.jpg"
        self.request = RequestFactory().get(f"/?state={malicious_state}&code=fake_code")
        self.request.session = Client().session
        self.request.subdomain = None
        
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        response = self.view.dispatch(self.request, pipeline)

        # Should still redirect to OAuth provider with newly generated state
        assert response.status_code == 302
        assert response["Location"].startswith("https://example.org/oauth2/authorize")
        redirect_url = urlparse(response["Location"])
        query = parse_qs(redirect_url.query)
        
        # Verify a new state was generated (not the malicious one)
        assert "state" in query
        assert query["state"][0] != malicious_state
        
        # Verify the state was stored in the pipeline
        stored_state = pipeline.fetch_state("state")
        assert stored_state is not None
        assert stored_state == query["state"][0]

    def test_parameter_pollution_with_error(self) -> None:
        """Test that injecting an error parameter doesn't bypass state generation"""
        self.request = RequestFactory().get("/?error=access_denied")
        self.request.session = Client().session
        self.request.subdomain = None
        
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        response = self.view.dispatch(self.request, pipeline)

        # Should still redirect to OAuth provider with newly generated state
        assert response.status_code == 302
        assert response["Location"].startswith("https://example.org/oauth2/authorize")
        redirect_url = urlparse(response["Location"])
        query = parse_qs(redirect_url.query)
        
        # Verify a state was generated
        assert "state" in query
        
        # Verify the state was stored in the pipeline
        stored_state = pipeline.fetch_state("state")
        assert stored_state is not None
        assert stored_state == query["state"][0]

    def test_parameter_pollution_with_code_only(self) -> None:
        """Test that injecting only a code parameter doesn't bypass state generation"""
        self.request = RequestFactory().get("/?code=fake_code_value")
        self.request.session = Client().session
        self.request.subdomain = None
        
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        response = self.view.dispatch(self.request, pipeline)

        # Should still redirect to OAuth provider with newly generated state
        assert response.status_code == 302
        assert response["Location"].startswith("https://example.org/oauth2/authorize")
        redirect_url = urlparse(response["Location"])
        query = parse_qs(redirect_url.query)
        
        # Verify a new state was generated
        assert "state" in query
        
        # Verify the state was stored in the pipeline
        stored_state = pipeline.fetch_state("state")
        assert stored_state is not None
        assert stored_state == query["state"][0]

    def test_legitimate_callback_with_stored_state(self) -> None:
        """Test that legitimate OAuth callbacks work correctly when state is stored"""
        # First, initialize the pipeline and simulate the initial OAuth redirect
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        initial_response = self.view.dispatch(self.request, pipeline)
        
        # Verify initial redirect happened and state was stored
        assert initial_response.status_code == 302
        assert initial_response["Location"].startswith("https://example.org/oauth2/authorize")
        stored_state = pipeline.fetch_state("state")
        assert stored_state is not None
        
        # Now simulate the OAuth callback with code and state using the same session
        callback_request = RequestFactory().get(f"/?state={stored_state}&code=auth_code_123")
        callback_request.session = self.request.session
        callback_request.subdomain = None
        
        # Create a new pipeline instance that shares the same session
        callback_pipeline = IdentityPipeline(request=callback_request, provider_key="dummy")
        
        # The dispatch should proceed to next_step because stored state exists
        response = self.view.dispatch(callback_request, callback_pipeline)
        
        # The response should NOT redirect back to the OAuth provider
        # It should proceed to the next step in the pipeline
        if response.status_code == 302:
            assert not response["Location"].startswith("https://example.org/oauth2/authorize")
