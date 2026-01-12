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

    def test_error_without_state_does_not_advance_pipeline(self) -> None:
        """
        Test that requests with error parameter but no state parameter
        do not advance the pipeline. This prevents security scanners from
        triggering pipeline errors.
        """
        # Simulate a request with only an error parameter (e.g., from a security scanner)
        request = RequestFactory().get("/?error=bxss.me")
        request.session = Client().session
        request.subdomain = None

        pipeline = IdentityPipeline(request=request, provider_key="dummy")
        response = self.view.dispatch(request, pipeline)

        # Should redirect to OAuth provider, not advance to next step
        assert response.status_code == 302
        assert response["Location"].startswith("https://example.org/oauth2/authorize")

    def test_code_without_state_does_not_advance_pipeline(self) -> None:
        """
        Test that requests with code parameter but no state parameter
        do not advance the pipeline.
        """
        # Simulate a request with only a code parameter
        request = RequestFactory().get("/?code=malicious-code")
        request.session = Client().session
        request.subdomain = None

        pipeline = IdentityPipeline(request=request, provider_key="dummy")
        response = self.view.dispatch(request, pipeline)

        # Should redirect to OAuth provider, not advance to next step
        assert response.status_code == 302
        assert response["Location"].startswith("https://example.org/oauth2/authorize")

    def test_state_parameter_advances_pipeline(self) -> None:
        """
        Test that requests with state parameter do advance the pipeline
        (to be validated in OAuth2CallbackView).
        """
        # Simulate a request with state parameter (legitimate OAuth callback)
        request = RequestFactory().get("/?state=some-state&code=auth-code")
        request.session = Client().session
        request.subdomain = None

        pipeline = IdentityPipeline(request=request, provider_key="dummy")
        
        # Mock the next_step to verify it's called
        from unittest.mock import Mock
        original_next_step = pipeline.next_step
        pipeline.next_step = Mock(return_value=original_next_step())
        
        self.view.dispatch(request, pipeline)

        # Should advance to next step
        pipeline.next_step.assert_called_once()

    def test_multiple_requests_with_error_param_regenerate_state(self) -> None:
        """
        Test that multiple requests with error parameter each generate
        a new state token and redirect to OAuth provider. This ensures
        security scanners repeatedly hitting the endpoint don't cause issues.
        """
        # First request with error param
        request1 = RequestFactory().get("/?error=bxss.me")
        request1.session = Client().session
        request1.subdomain = None

        pipeline1 = IdentityPipeline(request=request1, provider_key="dummy")
        response1 = self.view.dispatch(request1, pipeline1)

        assert response1.status_code == 302
        redirect_url1 = urlparse(response1["Location"])
        query1 = parse_qs(redirect_url1.query)
        state1 = query1["state"][0]

        # Second request with error param
        request2 = RequestFactory().get("/?error=another_scan")
        request2.session = Client().session
        request2.subdomain = None

        pipeline2 = IdentityPipeline(request=request2, provider_key="dummy")
        response2 = self.view.dispatch(request2, pipeline2)

        assert response2.status_code == 302
        redirect_url2 = urlparse(response2["Location"])
        query2 = parse_qs(redirect_url2.query)
        state2 = query2["state"][0]

        # Each request should generate a unique state
        assert state1 != state2

    def test_issue_reproduction_bxss_error_param(self) -> None:
        """
        Regression test for the reported issue where security scanners
        sending ?error=bxss.me would cause PipelineError.
        
        This test reproduces the exact scenario from the issue report:
        GET /identity/login/github/?error=bxss.me
        
        Before the fix: Would advance pipeline and trigger PipelineError
        After the fix: Treats it as initial request and redirects to OAuth provider
        """
        # Simulate the exact request from the issue report
        request = RequestFactory().get("/?error=bxss.me")
        request.session = Client().session
        request.subdomain = None

        pipeline = IdentityPipeline(request=request, provider_key="dummy")
        
        # Initialize the pipeline (this happens in the view before dispatch)
        pipeline.initialize()
        
        # Dispatch the request
        response = self.view.dispatch(request, pipeline)

        # Should redirect to OAuth provider, NOT throw PipelineError
        assert response.status_code == 302
        assert response["Location"].startswith("https://example.org/oauth2/authorize")
        
        # Verify that a state was generated and stored
        stored_state = pipeline.fetch_state("state")
        assert stored_state is not None
        
        # Verify the redirect includes the state parameter
        redirect_url = urlparse(response["Location"])
        query = parse_qs(redirect_url.query)
        assert "state" in query
        assert query["state"][0] == stored_state
