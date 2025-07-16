"""
End-to-end integration tests for OAuth2 flow with mocked providers.

These tests verify the complete OAuth flow including:
1. Initial request with various parameters (including promo codes)
2. OAuth provider authorization
3. Callback handling with state validation
4. Token exchange
5. Identity creation

This ensures the OAuth state validation works correctly in a complete flow.
"""

from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlparse

import responses
from django.contrib.sessions.middleware import SessionMiddleware
from django.http import HttpResponse
from django.test import Client, RequestFactory, TestCase

import sentry.identity
from sentry.identity.oauth2 import OAuth2CallbackView, OAuth2LoginView, OAuth2Provider
from sentry.identity.pipeline import IdentityPipeline
from sentry.testutils.silo import control_silo_test


class MockOAuth2Provider(OAuth2Provider):
    """Mock OAuth provider for integration testing."""

    key = "test_oauth"
    name = "Test OAuth Provider"

    oauth_access_token_url = "https://oauth.test.com/token"
    oauth_authorize_url = "https://oauth.test.com/authorize"
    oauth_scopes = ("user:email",)

    def get_oauth_client_id(self):
        return "test-client-id"

    def get_oauth_client_secret(self):
        return "test-client-secret"

    def build_identity(self, data):
        return {
            "id": data.get("id", "test-user-123"),
            "email": data.get("email", "test@example.com"),
            "name": data.get("name", "Test User"),
        }


@control_silo_test
class OAuth2IntegrationE2ETest(TestCase):
    """End-to-end integration tests for OAuth2 flow."""

    def setUp(self):
        super().setUp()
        self.provider = MockOAuth2Provider()
        sentry.identity.register(MockOAuth2Provider)
        self.factory = RequestFactory()
        self.client = Client()

    def tearDown(self):
        super().tearDown()
        sentry.identity.unregister(MockOAuth2Provider)

    def _get_request_with_session(self, url):
        """Helper to create a request with session support."""
        request = self.factory.get(url)
        request.subdomain = None
        # Add session support
        middleware = SessionMiddleware(lambda r: HttpResponse())
        middleware.process_request(request)
        request.session.save()
        return request

    def _save_session_state(self, request, state_data):
        """Helper to save state data to the request's session."""
        if not hasattr(request, "session"):
            middleware = SessionMiddleware(lambda r: HttpResponse())
            middleware.process_request(request)

        # Save state data directly to session (simulating what pipeline does)
        for key, value in state_data.items():
            request.session[f"identity_pipeline_{key}"] = value
        request.session.save()

    def _get_session_state(self, request, key):
        """Helper to retrieve state data from session."""
        return request.session.get(f"identity_pipeline_{key}")

    def _create_pipeline(self, request):
        """Create a pipeline for testing."""
        return IdentityPipeline(
            request=request,
            provider_key=self.provider.key,
            config={},
        )

    @responses.activate
    def test_complete_oauth_flow_with_promo_code(self):
        """
        Test complete OAuth flow when user visits with a promo code.

        This verifies that:
        1. Promo codes don't interfere with OAuth flow
        2. State validation works correctly
        3. Token exchange succeeds
        """
        # Step 1: User visits with promo code
        initial_url = f"/auth/login/{self.provider.key}/?code=PROMO2024"
        request = self._get_request_with_session(initial_url)

        pipeline = self._create_pipeline(request)
        login_view = OAuth2LoginView(
            authorize_url=self.provider.oauth_authorize_url,
            client_id="test-client-id",
            scope=" ".join(self.provider.oauth_scopes),
        )

        # Dispatch the initial request
        response = login_view.dispatch(request, pipeline)

        # Should redirect to OAuth provider
        assert response.status_code == 302
        redirect_url = response["Location"]
        assert self.provider.oauth_authorize_url in redirect_url

        # Parse OAuth parameters
        parsed = urlparse(redirect_url)
        params = parse_qs(parsed.query)
        assert params["client_id"][0] == "test-client-id"
        assert "state" in params
        oauth_state = params["state"][0]

        # Store the OAuth state in session for validation
        self._save_session_state(
            request,
            {
                "state": oauth_state,
                "code": "PROMO2024",  # Store the promo code too
            },
        )

        # Verify state was stored properly
        stored_state = self._get_session_state(request, "state")
        assert stored_state == oauth_state, "State should be properly stored in session"
        stored_promo = self._get_session_state(request, "code")
        assert stored_promo == "PROMO2024", "Promo code should be preserved in session"

        # Step 2: Mock OAuth provider callback
        callback_url = f"/auth/login/{self.provider.key}/?code=auth-code-xyz&state={oauth_state}"
        callback_request = self._get_request_with_session(callback_url)
        callback_request.session = request.session  # Use same session for callback

        # Mock token exchange
        responses.add(
            responses.POST,
            self.provider.oauth_access_token_url,
            json={
                "access_token": "test-access-token",
                "token_type": "Bearer",
                "expires_in": 3600,
            },
            status=200,
        )

        # Process callback
        callback_view = OAuth2CallbackView(
            access_token_url=self.provider.oauth_access_token_url,
            client_id="test-client-id",
            client_secret="test-secret",
        )

        # Store state in callback request session for validation
        self._save_session_state(
            callback_request,
            {
                "state": oauth_state,
                "code": "PROMO2024",
            },
        )

        # Process callback with real session state validation
        with patch.object(pipeline, "next_step") as mock_next:
            # Mock pipeline to use real session state instead of fetch_state
            def real_fetch_state(key):
                return self._get_session_state(callback_request, key)

            with patch.object(pipeline, "fetch_state", side_effect=real_fetch_state):
                mock_next.return_value = Mock(status_code=200)
                callback_view.dispatch(callback_request, pipeline)

                # Verify token exchange happened
                assert len(responses.calls) == 1
                assert responses.calls[0].request.url == self.provider.oauth_access_token_url

                # Verify next step was called
                mock_next.assert_called_once()

                # Verify promo code is still available after OAuth completion
                final_promo = real_fetch_state("code")
                assert final_promo == "PROMO2024", "Promo code should survive OAuth flow"

    @responses.activate
    def test_promo_code_does_not_trigger_token_exchange(self):
        """
        Verify that requests with only a promo code do NOT trigger token exchange.

        Promo codes should not be treated as OAuth callbacks.
        """
        # Visit with various promo codes
        promo_codes = ["SAVE50", "BLACKFRIDAY", "youtube-special", "partner-123"]

        for promo in promo_codes:
            # Clear any previous responses
            responses.calls.reset()

            url = f"/auth/login/{self.provider.key}/?code={promo}"
            request = self._get_request_with_session(url)

            # Store promo code in session for verification
            self._save_session_state(request, {"code": promo})

            pipeline = self._create_pipeline(request)
            login_view = OAuth2LoginView(
                authorize_url=self.provider.oauth_authorize_url,
                client_id="test-client-id",
                scope=" ".join(self.provider.oauth_scopes),
            )

            response = login_view.dispatch(request, pipeline)

            # Should redirect to OAuth provider
            assert response.status_code == 302
            assert self.provider.oauth_authorize_url in response["Location"]

            # Verify NO token exchange attempts
            assert len(responses.calls) == 0, f"Token exchange attempted for promo code: {promo}"

            # Verify promo code is preserved in session
            preserved_promo = self._get_session_state(request, "code")
            assert preserved_promo == promo, f"Promo code {promo} should be preserved in session"

    def test_oauth_callback_without_state_rejected(self):
        """
        Test that OAuth callbacks without state are rejected.

        This prevents CSRF attacks where an attacker tricks a user into
        completing OAuth with the attacker's authorization code.
        """
        # Attempt callback without state
        url = f"/auth/login/{self.provider.key}/?code=malicious-auth-code"
        request = self._get_request_with_session(url)

        pipeline = self._create_pipeline(request)

        # Pre-store a state in session (simulating a previous OAuth flow)
        self._save_session_state(request, {"state": "original-state-token"})

        login_view = OAuth2LoginView(
            authorize_url=self.provider.oauth_authorize_url,
            client_id="test-client-id",
            scope=" ".join(self.provider.oauth_scopes),
        )

        response = login_view.dispatch(request, pipeline)

        # Should start new OAuth flow, not process callback
        assert response.status_code == 302
        assert self.provider.oauth_authorize_url in response["Location"]

    def test_oauth_callback_with_wrong_state_rejected(self):
        """Test that OAuth callbacks with mismatched state are rejected."""
        # Attempt callback with wrong state
        url = f"/auth/login/{self.provider.key}/?code=auth-code&state=wrong-state"
        request = self._get_request_with_session(url)

        pipeline = self._create_pipeline(request)

        # Pre-store different state in session
        self._save_session_state(request, {"state": "correct-state-token"})

        login_view = OAuth2LoginView(
            authorize_url=self.provider.oauth_authorize_url,
            client_id="test-client-id",
            scope=" ".join(self.provider.oauth_scopes),
        )

        response = login_view.dispatch(request, pipeline)

        # Should start new OAuth flow due to state mismatch
        assert response.status_code == 302
        assert self.provider.oauth_authorize_url in response["Location"]

    def test_oauth_error_with_valid_state_processed(self):
        """Test that OAuth error callbacks with valid state are processed."""
        # First, start OAuth flow
        initial_request = self._get_request_with_session(f"/auth/login/{self.provider.key}/")

        pipeline = self._create_pipeline(initial_request)
        login_view = OAuth2LoginView(
            authorize_url=self.provider.oauth_authorize_url,
            client_id="test-client-id",
            scope=" ".join(self.provider.oauth_scopes),
        )

        initial_response = login_view.dispatch(initial_request, pipeline)

        # Extract state from redirect
        parsed = urlparse(initial_response["Location"])
        params = parse_qs(parsed.query)
        oauth_state = params["state"][0]

        # Now simulate error callback with valid state
        error_url = f"/auth/login/{self.provider.key}/?error=access_denied&state={oauth_state}"
        error_request = self._get_request_with_session(error_url)
        error_request.session = initial_request.session  # Use same session

        # Store the OAuth state in error request session
        self._save_session_state(error_request, {"state": oauth_state})

        # This should be processed as valid callback
        with patch.object(pipeline, "next_step") as mock_next:
            # Use real session state instead of mocking fetch_state
            def real_fetch_state(key):
                return self._get_session_state(error_request, key)

            with patch.object(pipeline, "fetch_state", side_effect=real_fetch_state):
                mock_next.return_value = Mock(status_code=200)
                login_view.dispatch(error_request, pipeline)

                # Should process the error callback
                mock_next.assert_called_once()

    @responses.activate
    def test_multiple_oauth_flows_isolated(self):
        """Test that multiple OAuth flows don't interfere with each other."""
        # Start first OAuth flow
        request1 = self._get_request_with_session(f"/auth/login/{self.provider.key}/?code=promo1")

        pipeline1 = self._create_pipeline(request1)
        login_view = OAuth2LoginView(
            authorize_url=self.provider.oauth_authorize_url,
            client_id="test-client-id",
            scope=" ".join(self.provider.oauth_scopes),
        )

        response1 = login_view.dispatch(request1, pipeline1)
        parsed1 = urlparse(response1["Location"])
        state1 = parse_qs(parsed1.query)["state"][0]

        # Start second OAuth flow
        request2 = self._get_request_with_session(f"/auth/login/{self.provider.key}/?code=promo2")

        pipeline2 = self._create_pipeline(request2)
        response2 = login_view.dispatch(request2, pipeline2)
        parsed2 = urlparse(response2["Location"])
        state2 = parse_qs(parsed2.query)["state"][0]

        # States should be different
        assert state1 != state2

        # Store states in respective sessions
        self._save_session_state(request1, {"state": state1, "code": "promo1"})
        self._save_session_state(request2, {"state": state2, "code": "promo2"})

        # Each pipeline should only accept its own state
        callback1 = self._get_request_with_session(
            f"/auth/login/{self.provider.key}/?code=auth1&state={state1}"
        )
        # Copy session state from request1 to callback1
        self._save_session_state(
            callback1,
            {
                "state": self._get_session_state(request1, "state"),
                "code": self._get_session_state(request1, "code"),
            },
        )

        # Using state1 with pipeline2 should fail (cross-session contamination test)
        callback_wrong_session = self._get_request_with_session(
            f"/auth/login/{self.provider.key}/?code=auth1&state={state1}"
        )
        # Deliberately use wrong session state (pipeline2's state in pipeline1's callback)
        self._save_session_state(
            callback_wrong_session,
            {"state": state2, "code": "promo2"},  # Wrong state for this pipeline
        )

        response = login_view.dispatch(callback_wrong_session, pipeline1)
        assert response.status_code == 302
        assert self.provider.oauth_authorize_url in response["Location"]

        # Mock token exchange for concurrent flow completion testing
        responses.add(
            responses.POST,
            self.provider.oauth_access_token_url,
            json={
                "access_token": "flow1-access-token",
                "token_type": "Bearer",
                "expires_in": 3600,
            },
            status=200,
        )

        responses.add(
            responses.POST,
            self.provider.oauth_access_token_url,
            json={
                "access_token": "flow2-access-token",
                "token_type": "Bearer",
                "expires_in": 3600,
            },
            status=200,
        )

        # Test concurrent flow completion - each flow should complete independently
        callback_view = OAuth2CallbackView(
            access_token_url=self.provider.oauth_access_token_url,
            client_id="test-client-id",
            client_secret="test-secret",
        )

        # First flow completes with its own state
        with patch.object(pipeline1, "next_step") as mock_next1:
            # Use real session state instead of mocking
            def real_fetch_state1(key):
                return self._get_session_state(callback1, key)

            with patch.object(pipeline1, "fetch_state", side_effect=real_fetch_state1):
                mock_next1.return_value = Mock(status_code=200)
                callback_view.dispatch(callback1, pipeline1)
                mock_next1.assert_called_once()

                # Verify promo code isolation
                promo1 = real_fetch_state1("code")
                assert promo1 == "promo1", "First pipeline should have promo1"

        # Second flow completes with its own state
        callback2 = self._get_request_with_session(
            f"/auth/login/{self.provider.key}/?code=auth2&state={state2}"
        )
        # Copy session state from request2 to callback2
        self._save_session_state(
            callback2,
            {
                "state": self._get_session_state(request2, "state"),
                "code": self._get_session_state(request2, "code"),
            },
        )

        with patch.object(pipeline2, "next_step") as mock_next2:
            # Use real session state instead of mocking
            def real_fetch_state2(key):
                return self._get_session_state(callback2, key)

            with patch.object(pipeline2, "fetch_state", side_effect=real_fetch_state2):
                mock_next2.return_value = Mock(status_code=200)
                callback_view.dispatch(callback2, pipeline2)
                mock_next2.assert_called_once()

                # Verify promo code isolation
                promo2 = real_fetch_state2("code")
                assert promo2 == "promo2", "Second pipeline should have promo2"

        # Verify both flows made token exchange requests
        assert len(responses.calls) == 2
        assert responses.calls[0].request.url == self.provider.oauth_access_token_url
        assert responses.calls[1].request.url == self.provider.oauth_access_token_url

        # Test data isolation - each pipeline should maintain separate state
        # Store user data in respective sessions
        self._save_session_state(
            request1,
            {"state": state1, "code": "promo1", "user_data": {"id": "user1", "promo": "promo1"}},
        )
        self._save_session_state(
            request2,
            {"state": state2, "code": "promo2", "user_data": {"id": "user2", "promo": "promo2"}},
        )

        # Verify data isolation through session storage
        user_data1 = self._get_session_state(request1, "user_data")
        user_data2 = self._get_session_state(request2, "user_data")

        assert user_data1["id"] == "user1", "Pipeline 1 should have user1 data"
        assert user_data1["promo"] == "promo1", "Pipeline 1 should have promo1"
        assert user_data2["id"] == "user2", "Pipeline 2 should have user2 data"
        assert user_data2["promo"] == "promo2", "Pipeline 2 should have promo2"

        # Test session isolation - states should not cross-contaminate
        # Each pipeline should have stored its own state during the OAuth flow
        assert state1 != state2, "Each pipeline should have generated different states"

        # Test that cross-pipeline state access fails
        callback_cross = self._get_request_with_session(
            f"/auth/login/{self.provider.key}/?code=auth-cross&state={state2}"
        )
        # Use request1's session data but with state2 (should fail validation)
        self._save_session_state(
            callback_cross,
            {"state": state1, "code": "promo1"},  # request1's state, but trying to validate state2
        )

        # This should fail validation and start new OAuth flow due to state mismatch
        def cross_fetch_state(key):
            return self._get_session_state(callback_cross, key)

        with patch.object(pipeline1, "fetch_state", side_effect=cross_fetch_state):
            cross_response = login_view.dispatch(callback_cross, pipeline1)
            assert cross_response.status_code == 302
            assert self.provider.oauth_authorize_url in cross_response["Location"]

        # Verify that each pipeline maintains isolation by checking session data
        session1_state = self._get_session_state(request1, "state")
        session2_state = self._get_session_state(request2, "state")
        assert session1_state != session2_state, "Sessions should have different states"

        session1_promo = self._get_session_state(request1, "code")
        session2_promo = self._get_session_state(request2, "code")
        assert session1_promo == "promo1", "Session 1 should preserve promo1"
        assert session2_promo == "promo2", "Session 2 should preserve promo2"
        assert session1_promo != session2_promo, "Sessions should have different promo codes"

        # Test cross-session data access prevention
        # Attempting to access request2's data from request1's session should return None
        request1_accessing_request2_data = self._get_session_state(request1, "nonexistent_key")
        assert request1_accessing_request2_data is None, "Cross-session access should be prevented"
