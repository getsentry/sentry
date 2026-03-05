from unittest.mock import MagicMock, patch

import pytest
from rest_framework.exceptions import PermissionDenied, ValidationError

from sentry.integrations.cursor.integration import CursorAgentIntegration
from sentry.seer.explorer.coding_agent_handoff import _resolve_client, launch_coding_agents
from sentry.seer.models import SeerRepoDefinition
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import TestCase


def _repo(owner: str, name: str) -> SeerRepoDefinition:
    """Minimal SeerRepoDefinition for tests."""
    return SeerRepoDefinition(
        provider="github",
        owner=owner,
        name=name,
        external_id="123",
    )


class TestLaunchCodingAgents(TestCase):
    """Tests for launch_coding_agents function."""

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        self.run_id = 12345

    @patch("sentry.seer.explorer.coding_agent_handoff.store_coding_agent_states_to_seer")
    @patch("sentry.seer.explorer.coding_agent_handoff._validate_and_get_integration")
    def test_successful_launch(self, mock_validate, mock_store):
        """Test successful coding agent launch."""
        mock_integration = MagicMock()
        mock_integration.provider = "cursor"
        mock_installation = MagicMock()
        mock_installation.launch.return_value = MagicMock(
            dict=lambda: {"id": "agent-123", "url": "https://cursor.sh/agent"}
        )
        mock_validate.return_value = (mock_integration, mock_installation)

        result = launch_coding_agents(
            organization=self.organization,
            integration_id=1,
            run_id=self.run_id,
            prompt="Fix the bug",
            repos=[_repo("owner", "repo")],
        )

        assert len(result["successes"]) == 1
        assert len(result["failures"]) == 0
        assert result["successes"][0]["repo_name"] == "owner/repo"
        mock_installation.launch.assert_called_once()
        mock_store.assert_called_once()

    @patch("sentry.seer.explorer.coding_agent_handoff.store_coding_agent_states_to_seer")
    @patch("sentry.seer.explorer.coding_agent_handoff._validate_and_get_integration")
    def test_launch_raises_value_error(self, mock_validate, mock_store):
        """Test that ValueError from integration launch is handled as failure."""
        mock_integration = MagicMock()
        mock_installation = MagicMock()
        mock_installation.launch.side_effect = ValueError("Invalid repository name format")
        mock_validate.return_value = (mock_integration, mock_installation)

        result = launch_coding_agents(
            organization=self.organization,
            integration_id=1,
            run_id=self.run_id,
            prompt="Fix the bug",
            repos=[_repo("owner", "repo")],
        )

        assert len(result["successes"]) == 0
        assert len(result["failures"]) == 1
        assert result["failures"][0]["error_message"] == "Failed to launch coding agent"
        assert result["failures"][0]["failure_type"] == "generic"
        mock_installation.launch.assert_called_once()

    @patch("sentry.seer.explorer.coding_agent_handoff.store_coding_agent_states_to_seer")
    @patch("sentry.seer.explorer.coding_agent_handoff._validate_and_get_integration")
    def test_multiple_repos_partial_failure(self, mock_validate, mock_store):
        """Test handling of partial failures across multiple repos."""
        from requests import HTTPError

        mock_integration = MagicMock()
        mock_integration.provider = "cursor"
        mock_installation = MagicMock()
        # First call succeeds, second fails
        mock_installation.launch.side_effect = [
            MagicMock(dict=lambda: {"id": "agent-1"}),
            HTTPError("API Error"),
        ]
        mock_validate.return_value = (mock_integration, mock_installation)

        result = launch_coding_agents(
            organization=self.organization,
            integration_id=1,
            run_id=self.run_id,
            prompt="Fix the bug",
            repos=[_repo("owner", "repo1"), _repo("owner", "repo2")],
        )

        assert len(result["successes"]) == 1
        assert len(result["failures"]) == 1
        assert result["successes"][0]["repo_name"] == "owner/repo1"
        assert result["failures"][0]["repo_name"] == "owner/repo2"

    @patch("sentry.seer.explorer.coding_agent_handoff.store_coding_agent_states_to_seer")
    @patch("sentry.seer.explorer.coding_agent_handoff._validate_and_get_integration")
    def test_branch_name_is_sanitized(self, mock_validate, mock_store):
        """Test that branch name is sanitized before launch."""
        mock_integration = MagicMock()
        mock_installation = MagicMock()
        mock_installation.launch.return_value = MagicMock(dict=lambda: {"id": "agent-1"})
        mock_validate.return_value = (mock_integration, mock_installation)

        launch_coding_agents(
            organization=self.organization,
            integration_id=1,
            run_id=self.run_id,
            prompt="Fix the bug",
            repos=[_repo("owner", "repo")],
            branch_name_base="my-fix",
        )

        # Verify launch was called with a sanitized branch name
        launch_request = mock_installation.launch.call_args[0][0]
        assert launch_request.branch_name.startswith("my-fix-")

    @patch("sentry.seer.explorer.coding_agent_handoff.store_coding_agent_states_to_seer")
    @patch("sentry.seer.explorer.coding_agent_handoff.GithubCopilotAgentClient")
    @patch("sentry.seer.explorer.coding_agent_handoff.github_copilot_identity_service")
    @patch("sentry.seer.explorer.coding_agent_handoff.features.has")
    def test_copilot_not_licensed_403_returns_github_copilot_not_licensed_failure_type(
        self,
        mock_features,
        mock_identity_service,
        mock_copilot_client_class,
        mock_store,
    ):
        """Test that Copilot 403 'not licensed' errors return github_copilot_not_licensed failure_type.

        When GitHub Copilot returns a 403 with "not licensed to use Copilot", the user's
        account lacks an active Copilot subscription. This is distinct from a GitHub App
        permissions issue, so we should NOT show the permissions modal.
        """
        mock_features.return_value = True
        mock_identity_service.get_access_token_for_user.return_value = "test-token"

        mock_client_instance = MagicMock()
        mock_copilot_client_class.return_value = mock_client_instance
        mock_client_instance.launch.side_effect = ApiError(
            "unauthorized: not licensed to use Copilot", code=403
        )

        result = launch_coding_agents(
            organization=self.organization,
            integration_id=None,
            run_id=self.run_id,
            prompt="Fix the bug",
            repos=[_repo("owner", "repo")],
            provider="github_copilot",
            user_id=1,
        )

        assert len(result["successes"]) == 0
        assert len(result["failures"]) == 1
        failure = result["failures"][0]
        assert failure["failure_type"] == "github_copilot_not_licensed"
        assert "Copilot license" in failure["error_message"]

    @patch("sentry.seer.explorer.coding_agent_handoff.store_coding_agent_states_to_seer")
    @patch("sentry.seer.explorer.coding_agent_handoff._validate_and_get_integration")
    def test_verify_branch_error_returns_cursor_github_access_failure_type(
        self, mock_validate, mock_store
    ):
        """Test that a 400 ApiError with 'Failed to verify existence of branch' returns cursor_github_access failure_type.

        When Cursor returns a 400 with this error, the Cursor GitHub App hasn't been
        granted access to the target repository. We should show the Cursor GitHub
        access modal instead of a generic error.
        """
        mock_integration = MagicMock()
        mock_installation = MagicMock(spec=CursorAgentIntegration)
        mock_installation.launch.side_effect = ApiError(
            text='{"error":"Failed to verify existence of branch \'main\' in repository owner/repo. Please ensure the branch name is correct."}',
            code=400,
        )
        mock_validate.return_value = (mock_integration, mock_installation)

        result = launch_coding_agents(
            organization=self.organization,
            integration_id=1,
            run_id=self.run_id,
            prompt="Fix the bug",
            repos=[_repo("owner", "repo")],
        )

        assert len(result["successes"]) == 0
        assert len(result["failures"]) == 1
        failure = result["failures"][0]
        assert failure["failure_type"] == "cursor_github_access"
        assert "Cursor does not have GitHub access" in failure["error_message"]
        assert "install the Cursor GitHub App" in failure["error_message"]


MOCK_HANDOFF_PATH = "sentry.seer.explorer.coding_agent_handoff"


class TestResolveClient(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()

    @patch(f"{MOCK_HANDOFF_PATH}._validate_and_get_integration")
    def test_returns_installation_for_cursor(self, mock_validate):
        mock_integration = MagicMock()
        mock_integration.provider = "cursor"
        mock_installation = MagicMock()
        mock_validate.return_value = (mock_integration, mock_installation)

        client, installation = _resolve_client(
            self.organization, integration_id=1, provider=None, user_id=None
        )

        assert client is None
        assert installation is mock_installation
        mock_validate.assert_called_once_with(self.organization, 1)

    @patch(f"{MOCK_HANDOFF_PATH}._validate_and_get_integration")
    def test_returns_client_for_claude_code(self, mock_validate):
        mock_integration = MagicMock()
        mock_integration.provider = "claude_code"
        mock_installation = MagicMock()
        mock_client = MagicMock()
        mock_installation.get_client.return_value = mock_client
        mock_validate.return_value = (mock_integration, mock_installation)

        client, installation = _resolve_client(
            self.organization, integration_id=1, provider=None, user_id=None
        )

        assert client is mock_client
        assert installation is None
        mock_installation.get_client.assert_called_once()

    @patch(f"{MOCK_HANDOFF_PATH}.features.has", return_value=True)
    @patch(f"{MOCK_HANDOFF_PATH}.github_copilot_identity_service")
    def test_returns_client_for_github_copilot(self, mock_identity_service, mock_features):
        mock_identity_service.get_access_token_for_user.return_value = "test-token"

        client, installation = _resolve_client(
            self.organization, integration_id=None, provider="github_copilot", user_id=1
        )

        assert client is not None
        assert installation is None
        mock_identity_service.get_access_token_for_user.assert_called_once_with(user_id=1)

    @patch(f"{MOCK_HANDOFF_PATH}.features.has", return_value=False)
    def test_raises_permission_denied_when_copilot_not_enabled(self, mock_features):
        with pytest.raises(PermissionDenied):
            _resolve_client(
                self.organization, integration_id=None, provider="github_copilot", user_id=1
            )

    @patch(f"{MOCK_HANDOFF_PATH}.features.has", return_value=True)
    @patch(f"{MOCK_HANDOFF_PATH}.github_copilot_identity_service")
    def test_raises_permission_denied_when_no_copilot_token(
        self, mock_identity_service, mock_features
    ):
        mock_identity_service.get_access_token_for_user.return_value = None

        with pytest.raises(PermissionDenied):
            _resolve_client(
                self.organization, integration_id=None, provider="github_copilot", user_id=1
            )

    @patch(f"{MOCK_HANDOFF_PATH}.features.has", return_value=True)
    def test_raises_permission_denied_when_copilot_no_user_id(self, mock_features):
        with pytest.raises(PermissionDenied):
            _resolve_client(
                self.organization, integration_id=None, provider="github_copilot", user_id=None
            )

    def test_raises_validation_error_when_no_integration_or_provider(self):
        with pytest.raises(ValidationError):
            _resolve_client(self.organization, integration_id=None, provider=None, user_id=None)
