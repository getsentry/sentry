"""
Tests for OAuth2 parameter pollution attack prevention.

This test file verifies that parameter pollution attacks are properly detected
and blocked across all critical OAuth parameters (code, error, state).
"""

from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from django.contrib.sessions.middleware import SessionMiddleware
from django.http import HttpResponse, HttpResponseRedirect
from django.test import RequestFactory

import sentry.identity
from sentry.identity.oauth2 import OAuth2LoginView
from sentry.identity.pipeline import IdentityPipeline
from sentry.identity.providers.dummy import DummyProvider
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class OAuth2ParameterPollutionTest(TestCase):
    """Tests for OAuth parameter pollution attack prevention."""

    def setUp(self):
        sentry.identity.register(DummyProvider)
        super().setUp()
        self.factory = RequestFactory()
        self.view = OAuth2LoginView(
            authorize_url="https://example.org/oauth2/authorize",
            client_id="123456",
            scope="all-the-things",
        )

    def tearDown(self):
        super().tearDown()
        sentry.identity.unregister(DummyProvider)

    def _get_request_with_session(self, url):
        """Helper to create a request with session support."""
        request = self.factory.get(url)
        request.subdomain = None
        request.user = self.create_user()
        # Add session support
        middleware = SessionMiddleware(lambda r: HttpResponse())
        middleware.process_request(request)
        request.session.save()
        return request

    def _create_initialized_pipeline(self, request, provider_key="dummy"):
        """Create a fully initialized real pipeline for testing."""
        pipeline = IdentityPipeline(
            request=request,
            provider_key=provider_key,
            config={},
        )
        pipeline.initialize()
        return pipeline

    @patch("sentry.identity.oauth2.logger")
    def test_state_parameter_pollution_blocked(self, mock_logger):
        """Test that multiple state parameters are blocked."""
        # Attack with multiple state parameters
        request = self._get_request_with_session(
            "/?code=attacker_code&state=wrong_state&state=legitimate_state"
        )
        pipeline = self._create_initialized_pipeline(request)

        # Store legitimate state
        pipeline.bind_state("state", "legitimate_state")

        response = self.view.dispatch(request, pipeline)

        # Should start new OAuth flow, not process callback
        assert isinstance(response, HttpResponseRedirect)
        assert response.status_code == 302
        assert "example.org/oauth2/authorize" in response["Location"]

        # Verify pollution attack was logged
        mock_logger.warning.assert_called_once()
        call_args = mock_logger.warning.call_args
        assert call_args[0][0] == "OAuth parameter pollution attack detected"

        extra = call_args[1]["extra"]
        assert extra["provider"] == "dummy"
        assert extra["state_count"] == 2
        assert extra["code_count"] == 1
        assert extra["error_count"] == 0

    @patch("sentry.identity.oauth2.logger")
    def test_code_parameter_pollution_blocked(self, mock_logger):
        """Test that multiple code parameters are blocked."""
        # Attack with multiple code parameters
        request = self._get_request_with_session(
            "/?code=legitimate_code&code=attacker_code&state=valid_state"
        )
        pipeline = self._create_initialized_pipeline(request)

        # Store valid state
        pipeline.bind_state("state", "valid_state")

        response = self.view.dispatch(request, pipeline)

        # Should start new OAuth flow, not process callback
        assert isinstance(response, HttpResponseRedirect)
        assert response.status_code == 302
        assert "example.org/oauth2/authorize" in response["Location"]

        # Verify pollution attack was logged
        mock_logger.warning.assert_called_once()
        call_args = mock_logger.warning.call_args
        assert call_args[0][0] == "OAuth parameter pollution attack detected"

        extra = call_args[1]["extra"]
        assert extra["code_count"] == 2
        assert extra["state_count"] == 1
        assert extra["error_count"] == 0

    @patch("sentry.identity.oauth2.logger")
    def test_error_parameter_pollution_blocked(self, mock_logger):
        """Test that multiple error parameters are blocked."""
        # Attack with multiple error parameters
        request = self._get_request_with_session(
            "/?error=access_denied&error=server_error&state=valid_state"
        )
        pipeline = self._create_initialized_pipeline(request)

        # Store valid state
        pipeline.bind_state("state", "valid_state")

        response = self.view.dispatch(request, pipeline)

        # Should start new OAuth flow, not process callback
        assert isinstance(response, HttpResponseRedirect)
        assert response.status_code == 302
        assert "example.org/oauth2/authorize" in response["Location"]

        # Verify pollution attack was logged
        mock_logger.warning.assert_called_once()
        call_args = mock_logger.warning.call_args
        assert call_args[0][0] == "OAuth parameter pollution attack detected"

        extra = call_args[1]["extra"]
        assert extra["error_count"] == 2
        assert extra["state_count"] == 1
        assert extra["code_count"] == 0

    @patch("sentry.identity.oauth2.logger")
    def test_multiple_parameter_pollution_blocked(self, mock_logger):
        """Test that pollution across multiple parameters is blocked."""
        # Attack with pollution on all parameters
        request = self._get_request_with_session(
            "/?code=code1&code=code2&error=err1&error=err2&state=state1&state=state2"
        )
        pipeline = self._create_initialized_pipeline(request)

        response = self.view.dispatch(request, pipeline)

        # Should start new OAuth flow
        assert isinstance(response, HttpResponseRedirect)
        assert response.status_code == 302
        assert "example.org/oauth2/authorize" in response["Location"]

        # Verify pollution attack was logged
        mock_logger.warning.assert_called_once()
        call_args = mock_logger.warning.call_args

        extra = call_args[1]["extra"]
        assert extra["code_count"] == 2
        assert extra["error_count"] == 2
        assert extra["state_count"] == 2

    def test_single_parameters_continue_working(self):
        """Test that single parameters continue to work normally."""
        # Valid OAuth callback with single parameters
        request = self._get_request_with_session("/?code=valid_auth_code&state=legitimate_state")
        pipeline = self._create_initialized_pipeline(request)

        # Store matching state
        pipeline.bind_state("state", "legitimate_state")

        with patch.object(pipeline, "next_step") as mock_next_step:
            mock_next_step.return_value = HttpResponse(status=200)
            self.view.dispatch(request, pipeline)

            # Should process callback normally
            mock_next_step.assert_called_once()

    def test_code_and_error_both_present_rejected(self):
        """Test that having both code and error is rejected per RFC 6749."""
        # Invalid: both code and error present (violates RFC 6749)
        request = self._get_request_with_session(
            "/?code=auth_code&error=access_denied&state=valid_state"
        )
        pipeline = self._create_initialized_pipeline(request)

        # Store valid state
        pipeline.bind_state("state", "valid_state")

        response = self.view.dispatch(request, pipeline)

        # Should start new OAuth flow (not treat as valid callback)
        assert isinstance(response, HttpResponseRedirect)
        assert response.status_code == 302
        assert "example.org/oauth2/authorize" in response["Location"]

    @patch("sentry.identity.oauth2.logger")
    def test_pollution_logging_includes_security_context(self, mock_logger):
        """Test that pollution attacks log security-relevant context."""
        request = self._get_request_with_session(
            "/?code=code1&code=code2&state=state1&state=state2"
        )
        # Simulate attack context
        request.META["REMOTE_ADDR"] = "192.168.1.100"
        request.META["HTTP_USER_AGENT"] = "AttackerBot/1.0"
        request.META["HTTP_REFERER"] = "https://evil.com/attack"

        pipeline = self._create_initialized_pipeline(request)
        self.view.dispatch(request, pipeline)

        # Verify security context is logged
        mock_logger.warning.assert_called_once()
        call_args = mock_logger.warning.call_args

        extra = call_args[1]["extra"]
        assert extra["remote_addr"] == "192.168.1.100"
        assert extra["user_agent"] == "AttackerBot/1.0"
        assert extra["referer"] == "https://evil.com/attack"

    def test_error_callback_with_single_parameters_works(self):
        """Test that error callbacks with single parameters work correctly."""
        # Valid OAuth error callback
        request = self._get_request_with_session("/?error=access_denied&state=legitimate_state")
        pipeline = self._create_initialized_pipeline(request)

        # Store matching state
        pipeline.bind_state("state", "legitimate_state")

        with patch.object(pipeline, "next_step") as mock_next_step:
            mock_next_step.return_value = HttpResponse(status=200)
            self.view.dispatch(request, pipeline)

            # Should process error callback normally
            mock_next_step.assert_called_once()

    def test_empty_parameters_start_new_flow(self):
        """Test that requests without OAuth parameters start new flow."""
        # No OAuth parameters
        request = self._get_request_with_session("/")
        pipeline = self._create_initialized_pipeline(request)

        response = self.view.dispatch(request, pipeline)

        # Should start new OAuth flow
        assert isinstance(response, HttpResponseRedirect)
        assert response.status_code == 302
        assert "example.org/oauth2/authorize" in response["Location"]

        # Verify state was generated in redirect URL
        parsed_url = urlparse(response["Location"])
        oauth_params = parse_qs(parsed_url.query)
        assert "state" in oauth_params
        assert len(oauth_params["state"][0]) > 20  # Reasonable length for security token

    @patch("sentry.identity.oauth2.logger")
    def test_debug_logging_includes_parameter_counts(self, mock_logger):
        """Test that debug logging includes parameter counts for monitoring."""
        request = self._get_request_with_session("/?code=valid_code&state=valid_state")
        pipeline = self._create_initialized_pipeline(request)

        # Store matching state
        pipeline.bind_state("state", "valid_state")

        with patch.object(pipeline, "next_step") as mock_next_step:
            mock_next_step.return_value = HttpResponse(status=200)
            self.view.dispatch(request, pipeline)

        # Verify debug logging includes parameter counts
        mock_logger.debug.assert_called_once()
        call_args = mock_logger.debug.call_args

        extra = call_args[1]["extra"]
        assert extra["code_count"] == 1
        assert extra["error_count"] == 0
        assert extra["state_count"] == 1
        assert extra["is_callback"] is True
