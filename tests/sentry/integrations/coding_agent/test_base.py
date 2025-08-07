from unittest.mock import MagicMock, patch

from sentry.integrations.coding_agent.client import CodingAgentClient
from sentry.integrations.coding_agent.integration import (
    CodingAgentIntegration,
    CodingAgentIntegrationProvider,
)
from sentry.testutils.cases import TestCase


class TestCodingAgentProvider(CodingAgentIntegrationProvider):
    """Concrete implementation for testing."""

    key = "test_agent"
    name = "Test Agent"

    def get_agent_name(self) -> str:
        return "Test Agent"

    def get_agent_key(self) -> str:
        return "test_agent"

    def get_pipeline_views(self):
        return []

    def build_integration(self, state):
        return {
            "external_id": "test_agent",
            "name": "Test Agent",
            "metadata": {"api_key": "test_key"},
        }


class TestCodingAgentInstallation(CodingAgentIntegration):
    """Concrete implementation for testing."""

    def get_client(self):
        return TestCodingAgentClient(integration=self.model, api_key=self.api_key)


class TestCodingAgentClient(CodingAgentClient):
    """Concrete implementation for testing."""

    @property
    def base_url(self) -> str:
        return "https://api.test-agent.com/v1"

    def _get_auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}"}


class CodingAgentBaseTest(TestCase):

    def test_provider_abstract_methods(self):
        """Test that the provider abstract methods work correctly."""
        provider = TestCodingAgentProvider()

        assert provider.get_agent_name() == "Test Agent"
        assert provider.get_agent_key() == "test_agent"

    def test_integration_api_key_property(self):
        """Test that the integration can access API key from metadata."""
        mock_model = MagicMock()
        installation = TestCodingAgentInstallation(mock_model, 123)
        installation.metadata = {"api_key": "test_api_key_123"}

        assert installation.api_key == "test_api_key_123"

    @patch("sentry.integrations.coding_agent.client.CodingAgentClient.request")
    def test_integration_launch(self, mock_request):
        """Test that the integration launch method works."""
        mock_request.return_value = {"status": "launched"}

        mock_model = MagicMock()
        installation = TestCodingAgentInstallation(mock_model, 123)
        installation.metadata = {"api_key": "test_api_key_123"}

        webhook_url = "https://sentry.io/webhook"
        result = installation.launch(webhook_url=webhook_url, extra_data="test")

        assert result == {"status": "launched"}
        mock_request.assert_called_once_with(
            "POST", "/launch", json={"webhook_url": webhook_url, "extra_data": "test"}
        )

    def test_client_base_url_property(self):
        """Test that the client base_url property works."""
        mock_integration = MagicMock()
        client = TestCodingAgentClient(mock_integration, "test_key")

        assert client.base_url == "https://api.test-agent.com/v1"

    def test_client_auth_headers(self):
        """Test that the client auth headers work."""
        mock_integration = MagicMock()
        client = TestCodingAgentClient(mock_integration, "test_key_123")

        headers = client._get_auth_headers()
        assert headers == {"Authorization": "Bearer test_key_123"}

    @patch("sentry.integrations.coding_agent.client.CodingAgentClient._request")
    def test_client_request_adds_headers(self, mock_request):
        """Test that the client request method adds proper headers."""
        mock_request.return_value = {"success": True}

        mock_integration = MagicMock()
        client = TestCodingAgentClient(mock_integration, "test_key")

        result = client.request("GET", "/test")

        mock_request.assert_called_once_with(
            "GET",
            "https://api.test-agent.com/v1/test",
            headers={"Authorization": "Bearer test_key", "Content-Type": "application/json"},
        )
        assert result == {"success": True}
