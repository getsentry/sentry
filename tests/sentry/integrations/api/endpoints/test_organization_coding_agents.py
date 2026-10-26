import contextlib
from unittest.mock import MagicMock, Mock, patch

from sentry.testutils.cases import APITestCase


class BaseOrganizationCodingAgentsTest(APITestCase):
    """Base test class with common setup for coding agent endpoint tests."""

    endpoint = "sentry-api-0-organization-coding-agents"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self._setup_mock_integration()

    def _setup_mock_integration(self):
        """Set up mock integration and related objects for testing."""
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

        # Get the organization integration and serialize it using the integration service
        from sentry.integrations.services.integration import integration_service

        org_integration = integration_service.get_organization_integration(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )
        self.rpc_org_integration = org_integration

    def mock_integration_service_calls(self, integrations=None):
        """Helper to mock integration service calls for GET endpoint."""
        from unittest.mock import patch

        from sentry.integrations.services.integration import integration_service

        integrations = integrations or []

        @contextlib.contextmanager
        def mock_context():
            with (
                patch.object(
                    integration_service,
                    "get_integrations",
                    return_value=integrations,
                ),
                patch(
                    "sentry.seer.autofix.coding_agent.get_coding_agent_providers",
                    return_value=["test_provider"],
                ),
            ):
                yield

        return mock_context()


class StoreCodingAgentStatesToSeerTest(APITestCase):
    def test_batch_function_posts_correct_payload(self) -> None:
        from datetime import UTC, datetime
        from unittest.mock import patch

        from sentry.seer.autofix.coding_agent import store_coding_agent_states_to_seer
        from sentry.seer.autofix.constants import CodingAgentStatus
        from sentry.seer.autofix.utils import CodingAgentProviderType, CodingAgentState

        state1 = CodingAgentState(
            id="a1",
            status=CodingAgentStatus.PENDING,
            provider=CodingAgentProviderType.CURSOR_BACKGROUND_AGENT,
            name="Agent 1",
            started_at=datetime.now(UTC),
        )
        state2 = CodingAgentState(
            id="a2",
            status=CodingAgentStatus.PENDING,
            provider=CodingAgentProviderType.CURSOR_BACKGROUND_AGENT,
            name="Agent 2",
            started_at=datetime.now(UTC),
        )

        mocked_response = MagicMock()
        mocked_response.status = 200
        mocked_response.data = b"{}"

        with patch(
            "sentry.seer.autofix.coding_agent.make_store_coding_agent_states_request",
            return_value=mocked_response,
        ) as mocked_call:
            store_coding_agent_states_to_seer(run_id=5, coding_agent_states=[state1, state2])

            mocked_call.assert_called_once()
            body = mocked_call.call_args[0][0]
            assert body["run_id"] == 5
            assert isinstance(body["coding_agent_states"], list)
            assert len(body["coding_agent_states"]) == 2
            ids = {s["id"] for s in body["coding_agent_states"]}
            assert ids == {"a1", "a2"}


class OrganizationCodingAgentsGetTest(BaseOrganizationCodingAgentsTest):
    """Test class for GET endpoint functionality."""

    def test_no_integrations(self) -> None:
        """Test GET request with no coding agent integrations."""
        organization = self.create_organization(owner=self.user)

        response = self.get_response(organization.slug)

        assert response.status_code == 200
        assert response.data["integrations"] == []

    def test_with_mock_integration(self) -> None:
        """Test GET request with mocked coding agent integration."""
        organization = self.create_organization(owner=self.user)

        mock_integration = Mock()
        mock_integration.id = 1
        mock_integration.name = "Test Coding Agent"
        mock_integration.provider = "test_provider"

        with (
            self.mock_integration_service_calls(integrations=[mock_integration]),
        ):
            response = self.get_response(organization.slug)

        assert response.status_code == 200
        integrations = response.data["integrations"]
        assert len(integrations) == 1

        integration_data = integrations[0]
        assert integration_data["id"] == "1"
        assert integration_data["name"] == "Test Coding Agent"
        assert integration_data["provider"] == "test_provider"

    @patch("sentry.integrations.services.integration.integration_service.get_integrations")
    def test_returns_coding_agent_integrations(self, mock_get_integrations):
        """Test GET endpoint returns coding agent integrations."""
        mock_integration = Mock()
        mock_integration.id = self.integration.id
        mock_integration.name = "GitHub"
        mock_integration.provider = "github"
        mock_get_integrations.return_value = [mock_integration]

        response = self.get_success_response(self.organization.slug)

        assert "integrations" in response.data
        integrations = response.data["integrations"]
        assert len(integrations) == 1
        integration_data = integrations[0]

        # The endpoint only returns basic integration data
        assert integration_data["id"] == str(self.integration.id)
        assert integration_data["name"] == "GitHub"
        assert integration_data["provider"] == "github"

    @patch("sentry.integrations.services.integration.integration_service.get_integrations")
    def test_handles_integration_processing_error(self, mock_get_integrations):
        """Test GET endpoint handles empty integrations gracefully."""
        mock_get_integrations.return_value = []

        response = self.get_success_response(self.organization.slug)

        assert "integrations" in response.data
        assert len(response.data["integrations"]) == 0

    @patch("sentry.integrations.services.integration.integration_service.get_integrations")
    def test_handles_service_error(self, mock_get_integrations):
        """Test GET endpoint handles organization integrations service errors."""
        # Mock service to raise an exception
        mock_get_integrations.side_effect = Exception("Service unavailable")

        response = self.get_error_response(self.organization.slug, status_code=500)
        assert response.status_code == 500

    @patch(
        "sentry.integrations.services.integration.integration_service.get_organization_integrations"
    )
    @patch("sentry.integrations.services.integration.integration_service.get_integration")
    def test_handles_integration_not_found(self, mock_get_integration, mock_get_org_integrations):
        """Test GET endpoint handles case where integration is not found."""
        # Mock organization integrations but integration lookup returns None
        mock_get_org_integrations.return_value = [self.rpc_org_integration]
        mock_get_integration.return_value = None

        response = self.get_success_response(self.organization.slug)

        # Should skip integrations that can't be found
        assert "integrations" in response.data
        assert len(response.data["integrations"]) == 0

    def _mock_github_copilot_integration(self):
        mock = Mock()
        mock.id = 99
        mock.name = "GitHub Copilot"
        mock.provider = "github_copilot"
        return mock

    def test_github_copilot_shown_when_installed(self):
        """Test GET endpoint shows GitHub Copilot when installed."""
        copilot = self._mock_github_copilot_integration()
        with self.mock_integration_service_calls(integrations=[copilot]):
            response = self.get_success_response(self.organization.slug)

            integrations = response.data["integrations"]
            assert len(integrations) == 1
            assert integrations[0]["id"] is None
            assert integrations[0]["name"] == "GitHub Copilot"
            assert integrations[0]["provider"] == "github_copilot"
            assert integrations[0]["requires_identity"] is True
            assert integrations[0]["has_identity"] is False

    def test_github_copilot_not_shown_when_not_installed(self):
        """Test GET endpoint does not show GitHub Copilot when integration is not installed."""
        with self.mock_integration_service_calls(integrations=[]):
            response = self.get_success_response(self.organization.slug)
            assert response.data["integrations"] == []

    @patch(
        "sentry.integrations.api.endpoints.organization_coding_agents.github_copilot_identity_service"
    )
    def test_github_copilot_has_identity_true_when_authenticated(self, mock_identity_service):
        """Test GET endpoint returns has_identity: True when user has GitHub Copilot OAuth token."""
        mock_identity_service.get_access_token_for_user.return_value = "mock-access-token"
        copilot = self._mock_github_copilot_integration()

        with self.mock_integration_service_calls(integrations=[copilot]):
            response = self.get_success_response(self.organization.slug)

            integrations = response.data["integrations"]
            assert len(integrations) == 1
            assert integrations[0]["provider"] == "github_copilot"
            assert integrations[0]["has_identity"] is True
            mock_identity_service.get_access_token_for_user.assert_called_once_with(
                user_id=self.user.id
            )

    @patch(
        "sentry.integrations.api.endpoints.organization_coding_agents.github_copilot_identity_service"
    )
    def test_github_copilot_has_identity_false_when_not_authenticated(self, mock_identity_service):
        """Test GET endpoint returns has_identity: False when user doesn't have GitHub Copilot OAuth token."""
        mock_identity_service.get_access_token_for_user.return_value = None
        copilot = self._mock_github_copilot_integration()

        with self.mock_integration_service_calls(integrations=[copilot]):
            response = self.get_success_response(self.organization.slug)

            integrations = response.data["integrations"]
            assert len(integrations) == 1
            assert integrations[0]["provider"] == "github_copilot"
            assert integrations[0]["has_identity"] is False
            mock_identity_service.get_access_token_for_user.assert_called_once_with(
                user_id=self.user.id
            )

    @patch(
        "sentry.integrations.api.endpoints.organization_coding_agents.github_copilot_identity_service"
    )
    def test_github_copilot_handles_rpc_exception_gracefully(self, mock_identity_service):
        """Test GET endpoint handles RPC exceptions gracefully when checking GitHub Copilot identity."""
        from sentry.hybridcloud.rpc.service import RpcRemoteException

        mock_identity_service.get_access_token_for_user.side_effect = RpcRemoteException(
            "github_copilot_identity", "get_access_token_for_user", "Service unavailable"
        )
        copilot = self._mock_github_copilot_integration()

        with self.mock_integration_service_calls(integrations=[copilot]):
            response = self.get_success_response(self.organization.slug)

            integrations = response.data["integrations"]
            assert len(integrations) == 1
            assert integrations[0]["provider"] == "github_copilot"
            assert integrations[0]["has_identity"] is False
            mock_identity_service.get_access_token_for_user.assert_called_once_with(
                user_id=self.user.id
            )
