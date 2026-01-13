"""
Test that OAuth1 nonce reuse is prevented during HTTP retries.

This test validates the fix for the issue where HTTP client retries would
reuse the same OAuth1 signature/nonce, causing Jira Server to reject the
request with "oauth_problem=nonce_used".
"""

from unittest.mock import Mock, patch

from requests import PreparedRequest, Request

from sentry.integrations.jira_server.client import JiraServerClient, JiraServerSetupClient
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from tests.sentry.integrations.jira_server import EXAMPLE_PRIVATE_KEY


@control_silo_test
class JiraServerOAuth1NoRetryTest(TestCase):
    """
    Test that Jira Server clients have retries disabled to prevent OAuth1 nonce reuse.
    """

    def setUp(self) -> None:
        self.integration = self.create_provider_integration(
            provider="jira_server",
            name="Jira Server",
            metadata={"base_url": "https://jira.example.com", "verify_ssl": True},
        )

        idp = self.create_identity_provider(integration=self.integration)
        self.identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="jira:123",
            data={
                "consumer_key": "cnsmr-key",
                "private_key": EXAMPLE_PRIVATE_KEY,
                "access_token": "acs-tkn",
                "access_token_secret": "acs-tkn-scrt",
            },
        )
        self.integration.add_organization(
            self.organization, self.user, default_auth_id=self.identity.id
        )

    def test_jira_server_client_has_no_retries(self) -> None:
        """
        Verify that JiraServerClient creates a session with max_retries=0.

        This prevents the HTTP client from automatically retrying requests
        with the same OAuth1 signature/nonce, which would be rejected by
        Jira Server as a replay attack.
        """
        install = self.integration.get_installation(self.organization.id)
        client: JiraServerClient = install.get_client()

        # Create a session and verify it has no retries configured
        session = client.build_session()

        # Check that the adapters mounted on the session have max_retries=0
        https_adapter = session.get_adapter("https://example.com")
        http_adapter = session.get_adapter("http://example.com")

        assert https_adapter.max_retries.total == 0, (
            "HTTPS adapter should have max_retries=0 to prevent OAuth1 nonce reuse"
        )
        assert http_adapter.max_retries.total == 0, (
            "HTTP adapter should have max_retries=0 to prevent OAuth1 nonce reuse"
        )

    def test_jira_server_setup_client_has_no_retries(self) -> None:
        """
        Verify that JiraServerSetupClient creates a session with max_retries=0.

        The setup client also uses OAuth1 and must prevent nonce reuse.
        """
        client = JiraServerSetupClient(
            base_url="https://jira.example.com",
            consumer_key="test-key",
            private_key=EXAMPLE_PRIVATE_KEY,
            verify_ssl=True,
        )

        # Create a session and verify it has no retries configured
        session = client.build_session()

        # Check that the adapters mounted on the session have max_retries=0
        https_adapter = session.get_adapter("https://example.com")
        http_adapter = session.get_adapter("http://example.com")

        assert https_adapter.max_retries.total == 0, (
            "HTTPS adapter should have max_retries=0 to prevent OAuth1 nonce reuse"
        )
        assert http_adapter.max_retries.total == 0, (
            "HTTP adapter should have max_retries=0 to prevent OAuth1 nonce reuse"
        )

    def test_oauth_signature_uniqueness_across_requests(self) -> None:
        """
        Verify that each request gets a unique OAuth signature/nonce.

        While we prevent retries, this test ensures that if someone explicitly
        makes multiple requests, each gets a unique OAuth nonce.
        """
        install = self.integration.get_installation(self.organization.id)
        client: JiraServerClient = install.get_client()

        # Create two separate requests
        request1 = Request(method="GET", url=f"{client.base_url}/rest/api/2/serverInfo").prepare()
        request2 = Request(method="GET", url=f"{client.base_url}/rest/api/2/serverInfo").prepare()

        # Authorize both requests
        authorized1 = client.authorize_request(prepared_request=request1)
        authorized2 = client.authorize_request(prepared_request=request2)

        # Extract the Authorization headers
        auth1 = authorized1.headers.get("Authorization", "")
        auth2 = authorized2.headers.get("Authorization", "")

        # Both should have OAuth headers
        assert "oauth_nonce" in auth1, "First request should have OAuth nonce"
        assert "oauth_nonce" in auth2, "Second request should have OAuth nonce"

        # The nonces should be different (this proves each request gets a unique nonce)
        # Extract nonce values by finding oauth_nonce="value" pattern
        import re

        nonce1_match = re.search(r'oauth_nonce="([^"]+)"', auth1)
        nonce2_match = re.search(r'oauth_nonce="([^"]+)"', auth2)

        assert nonce1_match, "Should be able to extract nonce from first request"
        assert nonce2_match, "Should be able to extract nonce from second request"

        nonce1 = nonce1_match.group(1)
        nonce2 = nonce2_match.group(1)

        assert nonce1 != nonce2, (
            f"Each request should have a unique nonce. "
            f"Got nonce1={nonce1}, nonce2={nonce2}"
        )
