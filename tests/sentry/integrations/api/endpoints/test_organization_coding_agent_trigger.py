from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

from sentry.integrations.coding_agent.client import CodingAgentClient
from sentry.integrations.coding_agent.integration import (
    CodingAgentIntegration,
    CodingAgentIntegrationProvider,
)
from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.integrations.services.integration.serial import serialize_integration
from sentry.seer.autofix.utils import CodingAgentState, CodingAgentStatus
from sentry.testutils.cases import APITestCase


class MockCodingAgentProvider(CodingAgentIntegrationProvider):
    """Mock coding agent provider for tests."""

    key = "mock_agent"
    name = "Mock Agent"

    def get_agent_name(self) -> str:
        return "Mock Agent"

    def get_agent_key(self) -> str:
        return "mock_agent"

    def get_pipeline_views(self):
        return []

    def build_integration(self, state):
        return {
            "external_id": "mock_agent",
            "name": "Mock Agent",
            "metadata": {"api_key": "test_key"},
        }


class MockCodingAgentInstallation(CodingAgentIntegration):
    """Mock coding agent installation for tests."""

    def get_client(self):
        return MockCodingAgentClient(integration=self.model)


class MockCodingAgentClient(CodingAgentClient):
    """Mock coding agent client for tests."""

    @property
    def base_url(self) -> str:
        return "https://api.mock-agent.com/v1"

    def launch(self, webhook_url: str, request: CodingAgentLaunchRequest) -> CodingAgentState:
        """Mock implementation of launch method."""
        return CodingAgentState(
            id="mock-123",
            status=CodingAgentStatus.PENDING,
            name="Mock Agent",
            started_at=datetime.now(UTC),
        )


class OrganizationCodingAgentTriggerTest(APITestCase):
    endpoint = "sentry-api-0-organization-coding-agent-trigger"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

        # Mock the coding agent providers to include our mock provider
        self.mock_provider = MockCodingAgentProvider()

        # Create a GitHub integration to use as our test integration
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="GitHub",
            external_id="github:123",
            metadata={
                "api_key": "test_api_key_123",
                "domain_name": "github.com",
            },
        )

        # Create proper RPC objects using serialization
        self.rpc_integration = serialize_integration(self.integration)

        # Get the organization integration and serialize it using the integration service
        # (since we can't access OrganizationIntegration directly in region silo mode)
        from sentry.integrations.services.integration import integration_service

        org_integration = integration_service.get_organization_integration(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )
        self.rpc_org_integration = org_integration

        # Create mock installation
        self.mock_installation = MockCodingAgentInstallation(self.integration, self.organization.id)

    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integrations"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_get_coding_agent_integrations(self, mock_get_integration, mock_get_org_integrations):
        """Test GET endpoint returns coding agent integrations."""
        # Create a mock RPC integration with get_installation method
        mock_rpc_integration = MagicMock()
        mock_rpc_integration.id = self.integration.id
        mock_rpc_integration.name = self.integration.name
        mock_rpc_integration.provider = "github"
        mock_rpc_integration.metadata = self.integration.metadata
        mock_rpc_integration.get_installation.return_value = self.mock_installation

        # Mock integration service calls
        mock_get_org_integrations.return_value = [self.rpc_org_integration]
        mock_get_integration.return_value = mock_rpc_integration

        with self.feature("organizations:seer-coding-agent-integrations"):
            response = self.get_success_response(self.organization.slug)

            assert "integrations" in response.data
            integrations = response.data["integrations"]
            assert len(integrations) == 1
            integration_data = integrations[0]

            assert integration_data["id"] == str(self.integration.id)
            assert integration_data["name"] == "GitHub"
            assert integration_data["provider"] == "github"
            assert integration_data["status"] == "active"
            assert integration_data["metadata"]["domain_name"] == "github.com"
            assert integration_data["metadata"]["has_api_key"] is True
            assert "webhook_url" in integration_data

    def test_get_no_coding_agent_integrations(self):
        """Test GET endpoint with no coding agent integrations."""
        # Mock empty integration list
        with patch(
            "sentry.integrations.services.integration.integration_service.get_organization_integrations",
            return_value=[],
        ):
            with self.feature("organizations:seer-coding-agent-integrations"):
                response = self.get_success_response(self.organization.slug)
                assert "integrations" in response.data
                assert len(response.data["integrations"]) == 0

    @patch(
        "sentry.integrations.api.endpoints.organization_coding_agent_trigger.get_coding_agent_providers"
    )
    @patch("sentry.integrations.api.endpoints.organization_coding_agent_trigger.get_autofix_state")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_post_launch_coding_agent(
        self,
        mock_get_integration,
        mock_get_org_integration,
        mock_get_autofix_state,
        mock_get_providers,
    ):
        """Test POST endpoint launches coding agent."""
        # Mock coding agent providers to include github
        mock_get_providers.return_value = ["github"]

        # Create mock RPC integration with get_installation method
        mock_rpc_integration = MagicMock()
        mock_rpc_integration.id = self.integration.id
        mock_rpc_integration.name = self.integration.name
        mock_rpc_integration.provider = "github"
        mock_rpc_integration.metadata = self.integration.metadata

        # Ensure get_installation returns our mock coding agent installation
        mock_rpc_integration.get_installation = MagicMock(return_value=self.mock_installation)

        # Mock integration service calls
        mock_get_org_integration.return_value = self.rpc_org_integration
        mock_get_integration.return_value = mock_rpc_integration

        # Mock autofix state with required structure
        mock_autofix_state = MagicMock()
        mock_autofix_state.steps = [
            {"key": "solution", "solution": [{"relevant_code_file": {"repo_name": "test/repo"}}]}
        ]
        mock_autofix_state.request = {
            "repos": [
                {"owner": "test", "name": "repo", "external_id": "123", "provider": "github"}
            ],
            "issue": {"title": "Test Issue"},
        }
        mock_get_autofix_state.return_value = mock_autofix_state

        data = {
            "integration_id": str(self.integration.id),
            "run_id": 123,
        }

        with self.feature("organizations:seer-coding-agent-integrations"):
            response = self.get_success_response(self.organization.slug, method="post", **data)
            assert response.data["success"] is True

    def test_post_missing_integration_id(self):
        """Test POST endpoint with missing integration_id."""
        with self.feature("organizations:seer-coding-agent-integrations"):
            response = self.get_error_response(
                self.organization.slug, method="post", status_code=400
            )
            assert response.data["error"] == "integration_id is required"

    def test_post_invalid_integration_id(self):
        """Test POST endpoint with invalid integration_id."""
        data = {"integration_id": "invalid_id"}

        with self.feature("organizations:seer-coding-agent-integrations"):
            response = self.get_error_response(
                self.organization.slug, method="post", status_code=400, **data
            )
            assert response.data["error"] == "Invalid integration_id"

    def test_post_non_coding_agent_integration(self):
        """Test POST endpoint with non-coding agent integration."""
        # Create a non-coding agent integration (e.g., Slack)
        slack_integration = self.create_integration(
            organization=self.organization,
            provider="slack",
            name="Slack",
            external_id="slack:123",
        )

        data = {"integration_id": str(slack_integration.id)}

        with self.feature("organizations:seer-coding-agent-integrations"):
            response = self.get_error_response(
                self.organization.slug, method="post", status_code=400, **data
            )
            assert response.data["error"] == "Not a coding agent integration"

    @patch(
        "sentry.integrations.api.endpoints.organization_coding_agent_trigger.get_coding_agent_providers"
    )
    @patch("sentry.integrations.api.endpoints.organization_coding_agent_trigger.get_autofix_state")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_post_launch_with_all_parameters(
        self,
        mock_get_integration,
        mock_get_org_integration,
        mock_get_autofix_state,
        mock_get_providers,
    ):
        """Test POST endpoint with all launch parameters."""
        # Mock coding agent providers to include github
        mock_get_providers.return_value = ["github"]

        # Create mock RPC integration with get_installation method
        mock_rpc_integration = MagicMock()
        mock_rpc_integration.id = self.integration.id
        mock_rpc_integration.name = self.integration.name
        mock_rpc_integration.provider = "github"
        mock_rpc_integration.metadata = self.integration.metadata

        # Ensure get_installation returns our mock coding agent installation
        mock_rpc_integration.get_installation = MagicMock(return_value=self.mock_installation)

        # Mock integration service calls
        mock_get_org_integration.return_value = self.rpc_org_integration
        mock_get_integration.return_value = mock_rpc_integration

        # Mock autofix state with required structure
        mock_autofix_state = MagicMock()
        mock_autofix_state.steps = [
            {"key": "solution", "solution": [{"relevant_code_file": {"repo_name": "test/repo"}}]}
        ]
        mock_autofix_state.request = {
            "repos": [
                {"owner": "test", "name": "repo", "external_id": "123", "provider": "github"}
            ],
            "issue": {"title": "Test Issue"},
        }
        mock_get_autofix_state.return_value = mock_autofix_state

        data = {
            "integration_id": str(self.integration.id),
            "run_id": 123,
        }

        with self.feature("organizations:seer-coding-agent-integrations"):
            response = self.get_success_response(self.organization.slug, method="post", **data)
            assert response.data["success"] is True

    @patch(
        "sentry.integrations.api.endpoints.organization_coding_agent_trigger.get_coding_agent_providers"
    )
    @patch("sentry.integrations.api.endpoints.organization_coding_agent_trigger.get_autofix_state")
    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integration"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_post_launch_exception_handling(
        self,
        mock_get_integration,
        mock_get_org_integration,
        mock_get_autofix_state,
        mock_get_providers,
    ):
        """Test POST endpoint handles launch exceptions."""
        # Mock coding agent providers to include github
        mock_get_providers.return_value = ["github"]

        # Create mock RPC integration with get_installation method
        mock_rpc_integration = MagicMock()
        mock_rpc_integration.id = self.integration.id
        mock_rpc_integration.name = self.integration.name
        mock_rpc_integration.provider = "github"
        mock_rpc_integration.metadata = self.integration.metadata

        # Ensure get_installation returns our mock coding agent installation
        mock_rpc_integration.get_installation = MagicMock(return_value=self.mock_installation)

        # Mock integration service calls
        mock_get_org_integration.return_value = self.rpc_org_integration
        mock_get_integration.return_value = mock_rpc_integration

        # Mock get_autofix_state to return None (no state found)
        mock_get_autofix_state.return_value = None

        data = {"integration_id": str(self.integration.id), "run_id": 123}

        with self.feature("organizations:seer-coding-agent-integrations"):
            response = self.get_error_response(
                self.organization.slug, method="post", status_code=400, **data
            )
            assert response.data["error"] == "Autofix state not found"
