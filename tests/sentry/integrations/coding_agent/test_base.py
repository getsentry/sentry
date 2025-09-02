from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

from sentry.integrations.coding_agent.client import CodingAgentClient
from sentry.integrations.coding_agent.integration import (
    CodingAgentIntegration,
    CodingAgentIntegrationProvider,
)
from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.seer.autofix.utils import CodingAgentState, CodingAgentStatus
from sentry.seer.models import SeerRepoDefinition
from sentry.testutils.cases import TestCase


class MockCodingAgentProvider(CodingAgentIntegrationProvider):
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


class MockCodingAgentInstallation(CodingAgentIntegration):
    """Concrete implementation for testing."""

    def __init__(self, model, organization_id):
        super().__init__(model, organization_id)

    def get_client(self):
        return MockCodingAgentClient(integration=self.model)


class MockCodingAgentClient(CodingAgentClient):
    """Concrete implementation for testing."""

    base_url = "https://api.test-agent.com/v1"

    def launch(self, webhook_url: str, request: CodingAgentLaunchRequest) -> CodingAgentState:
        """Mock implementation of launch method."""
        return CodingAgentState(
            id="test-123",
            status=CodingAgentStatus.PENDING,
            name="Test Agent",
            started_at=datetime.now(UTC),
        )


class CodingAgentBaseTest(TestCase):
    def test_provider_abstract_methods(self):
        """Test that the provider abstract methods work correctly."""
        provider = MockCodingAgentProvider()

        assert provider.get_agent_name() == "Test Agent"
        assert provider.get_agent_key() == "test_agent"

    @patch.object(MockCodingAgentClient, "launch")
    def test_integration_launch(self, mock_launch):
        """Test that the integration launch method works."""
        mock_state = CodingAgentState(
            id="test-123",
            status=CodingAgentStatus.PENDING,
            name="Test Agent",
            started_at=datetime.now(UTC),
        )
        mock_launch.return_value = mock_state

        mock_model = MagicMock()
        mock_model.provider = "test_agent"
        installation = MockCodingAgentInstallation(mock_model, 123)

        repo = SeerRepoDefinition(
            provider="github",
            owner="test",
            name="test-repo",
            external_id="123",
        )
        request = CodingAgentLaunchRequest(
            prompt="Fix this bug",
            repository=repo,
            branch_name="main",
        )

        result = installation.launch(request=request)

        assert result == mock_state
        mock_launch.assert_called_once_with(
            webhook_url="http://testserver/extensions/test_agent/webhook/",
            request=request,
        )

    def test_integration_webhook_url_generation(self):
        """Test webhook URL generation."""
        mock_model = MagicMock()
        mock_model.provider = "test_agent"
        installation = MockCodingAgentInstallation(mock_model, 123)

        webhook_url = installation.get_webhook_url()
        assert webhook_url == "http://testserver/extensions/test_agent/webhook/"

    def test_client_abstract_methods(self):
        """Test that the client abstract methods are correctly defined."""
        mock_model = MagicMock()
        client = MockCodingAgentClient(integration=mock_model)

        assert hasattr(client, "launch")
        assert client.base_url == "https://api.test-agent.com/v1"

        repo = SeerRepoDefinition(
            provider="github",
            owner="test",
            name="test-repo",
            external_id="123",
        )
        request = CodingAgentLaunchRequest(
            prompt="Test prompt",
            repository=repo,
        )

        result = client.launch("http://webhook.url", request)
        assert isinstance(result, CodingAgentState)
        assert result.status == CodingAgentStatus.PENDING
        assert result.name == "Test Agent"

    def test_launch_request_model(self):
        """Test CodingAgentLaunchRequest model validation."""
        repo = SeerRepoDefinition(
            provider="github",
            owner="test",
            name="test-repo",
            external_id="123",
        )

        # Test required fields
        request = CodingAgentLaunchRequest(
            prompt="Fix this bug",
            repository=repo,
        )
        assert request.prompt == "Fix this bug"
        assert request.repository == repo
        assert request.branch_name is None

        # Test optional branch_name
        request_with_branch = CodingAgentLaunchRequest(
            prompt="Fix this bug",
            repository=repo,
            branch_name="main",
        )
        assert request_with_branch.branch_name == "main"
