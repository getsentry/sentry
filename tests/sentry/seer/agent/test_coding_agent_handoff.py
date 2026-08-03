from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone
from requests import HTTPError
from rest_framework.exceptions import PermissionDenied, ValidationError

from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.integrations.cursor.integration import CursorAgentIntegration
from sentry.seer.agent.coding_agent_handoff import _resolve_client, launch_coding_agents
from sentry.seer.autofix.utils import CodingAgentProviderType, CodingAgentState
from sentry.seer.models import SeerApiError, SeerRepoDefinition
from sentry.seer.models.run import SeerRunCodingAgentHandoff
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


def _state(agent_id: str = "agent-123", agent_url: str | None = None) -> CodingAgentState:
    return CodingAgentState(
        id=agent_id,
        provider=CodingAgentProviderType.CURSOR_BACKGROUND_AGENT,
        name="Cursor",
        started_at=timezone.now(),
        agent_url=agent_url,
    )


class FakeCodingAgentInstallation:
    def __init__(self, *results: CodingAgentState | Exception) -> None:
        self._results = list(results)
        self.launch_calls: list[CodingAgentLaunchRequest] = []

    def launch(self, request: CodingAgentLaunchRequest) -> CodingAgentState:
        self.launch_calls.append(request)
        result = self._results.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


class TestLaunchCodingAgents(TestCase):
    """Tests for launch_coding_agents function."""

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.run_id = 12345

    @patch("sentry.seer.agent.coding_agent_handoff.store_coding_agent_states_to_seer")
    @patch("sentry.seer.agent.coding_agent_handoff.validate_and_get_integration")
    def test_successful_launch(self, mock_validate, mock_store):
        """Test successful coding agent launch."""
        state = _state(agent_url="https://cursor.sh/agent")
        installation = FakeCodingAgentInstallation(state)
        mock_validate.return_value = (None, installation)

        result = launch_coding_agents(
            organization=self.organization,
            integration_id=1,
            run_id=self.run_id,
            prompt="Fix the bug",
            repos=[_repo("owner", "repo")],
            issue_short_id="AIML-2301",
        )

        assert len(result["successes"]) == 1
        assert len(result["failures"]) == 0
        assert result["successes"][0]["repo_name"] == "owner/repo"
        assert len(installation.launch_calls) == 1
        assert installation.launch_calls[0].issue_short_id == "AIML-2301"
        mock_store.assert_called_once_with(
            run_id=self.run_id,
            coding_agent_states=[state],
            organization_id=self.organization.id,
        )

    @patch("sentry.seer.agent.coding_agent_handoff.create_seer_run_coding_agent_handoff")
    @patch("sentry.seer.agent.coding_agent_handoff.store_coding_agent_states_to_seer")
    @patch("sentry.seer.agent.coding_agent_handoff.validate_and_get_integration")
    def test_handoff_row_created_per_repo_before_seer_store(
        self, mock_validate, mock_store, mock_create_handoff
    ):
        call_order: list[str] = []
        mock_create_handoff.side_effect = lambda *a, **k: call_order.append("create_handoff")
        mock_store.side_effect = lambda *a, **k: call_order.append("store_to_seer")

        installation = FakeCodingAgentInstallation(
            _state("agent-1"),
            _state("agent-2"),
        )
        mock_validate.return_value = (None, installation)

        launch_coding_agents(
            organization=self.organization,
            integration_id=1,
            run_id=self.run_id,
            prompt="Fix the bug",
            repos=[_repo("owner", "repo1"), _repo("owner", "repo2")],
        )

        assert mock_create_handoff.call_count == 2
        assert call_order == ["create_handoff", "create_handoff", "store_to_seer"]

    @patch("sentry.seer.agent.coding_agent_handoff.store_coding_agent_states_to_seer")
    @patch("sentry.seer.agent.coding_agent_handoff.validate_and_get_integration")
    def test_successful_launch_persists_seer_run_coding_agent_handoff_row(
        self, mock_validate, mock_store
    ):
        seer_run = self.create_seer_run(self.organization, seer_run_state_id=self.run_id)
        installation = FakeCodingAgentInstallation(
            _state("agent-123", agent_url="https://cursor.sh/agent")
        )
        mock_validate.return_value = (None, installation)

        launch_coding_agents(
            organization=self.organization,
            integration_id=1,
            run_id=self.run_id,
            prompt="Fix the bug",
            repos=[_repo("owner", "repo")],
        )

        handoff = SeerRunCodingAgentHandoff.objects.get(agent_id="agent-123")
        assert handoff.seer_run_id == seer_run.id
        assert handoff.provider == "cursor_background_agent"
        assert handoff.extras["agent_url"] == "https://cursor.sh/agent"
        assert handoff.status == "pending"

    @patch("sentry.seer.agent.coding_agent_handoff.store_coding_agent_states_to_seer")
    @patch("sentry.seer.agent.coding_agent_handoff.validate_and_get_integration")
    def test_leaves_handoffs_alone_when_seer_storage_errors(self, mock_validate, mock_store):
        self.create_seer_run(self.organization, seer_run_state_id=self.run_id)
        mock_store.side_effect = SeerApiError("Seer unavailable", status=503)
        installation = FakeCodingAgentInstallation(_state("agent-123"))
        mock_validate.return_value = (None, installation)

        result = launch_coding_agents(
            organization=self.organization,
            integration_id=1,
            run_id=self.run_id,
            prompt="Fix the bug",
            repos=[_repo("owner", "repo")],
        )

        # The provider launch itself still succeeded -- callers should still see it.
        assert len(result["successes"]) == 1

        handoff = SeerRunCodingAgentHandoff.objects.get(agent_id="agent-123")
        assert handoff.status == "pending"

    @patch("sentry.seer.agent.coding_agent_handoff.store_coding_agent_states_to_seer")
    @patch("sentry.seer.agent.coding_agent_handoff.validate_and_get_integration")
    def test_launch_raises_value_error(self, mock_validate, mock_store):
        """Test that ValueError from integration launch is handled as failure."""
        installation = FakeCodingAgentInstallation(ValueError("Invalid repository name format"))
        mock_validate.return_value = (None, installation)

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
        assert len(installation.launch_calls) == 1

    @patch("sentry.seer.agent.coding_agent_handoff.store_coding_agent_states_to_seer")
    @patch("sentry.seer.agent.coding_agent_handoff.validate_and_get_integration")
    def test_multiple_repos_partial_failure(self, mock_validate, mock_store):
        """Test handling of partial failures across multiple repos."""
        installation = FakeCodingAgentInstallation(
            _state("agent-1"),
            HTTPError("API Error"),
        )
        mock_validate.return_value = (None, installation)

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
        assert mock_store.call_args.kwargs["organization_id"] == self.organization.id

    @patch("sentry.seer.agent.coding_agent_handoff.store_coding_agent_states_to_seer")
    @patch("sentry.seer.agent.coding_agent_handoff.validate_and_get_integration")
    def test_branch_name_is_sanitized(self, mock_validate, mock_store):
        """Test that branch name is sanitized before launch."""
        installation = FakeCodingAgentInstallation(_state("agent-1"))
        mock_validate.return_value = (None, installation)

        launch_coding_agents(
            organization=self.organization,
            integration_id=1,
            run_id=self.run_id,
            prompt="Fix the bug",
            repos=[_repo("owner", "repo")],
            branch_name_base="my-fix",
        )

        assert installation.launch_calls[0].branch_name.startswith("my-fix-")
        assert mock_store.call_args.kwargs["organization_id"] == self.organization.id

    @patch("sentry.seer.agent.coding_agent_handoff.store_coding_agent_states_to_seer")
    @patch("sentry.seer.agent.coding_agent_handoff.GithubCopilotAgentClient")
    @patch("sentry.seer.agent.coding_agent_handoff.github_copilot_identity_service")
    def test_copilot_not_licensed_403_returns_github_copilot_not_licensed_failure_type(
        self,
        mock_identity_service,
        mock_copilot_client_class,
        mock_store,
    ):
        """Test that Copilot 403 'not licensed' errors return github_copilot_not_licensed failure_type.

        When GitHub Copilot returns a 403 with "not licensed to use Copilot", the user's
        account lacks an active Copilot subscription. This is distinct from a GitHub App
        permissions issue, so we should NOT show the permissions modal.
        """
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

    @patch("sentry.seer.agent.coding_agent_handoff.store_coding_agent_states_to_seer")
    @patch("sentry.seer.agent.coding_agent_handoff.validate_and_get_integration")
    def test_verify_branch_error_returns_cursor_github_access_failure_type(
        self, mock_validate, mock_store
    ):
        """Test that a 400 ApiError with 'Failed to verify existence of branch' returns cursor_github_access failure_type.

        When Cursor returns a 400 with this error, the Cursor GitHub App hasn't been
        granted access to the target repository. We should show the Cursor GitHub
        access modal instead of a generic error.
        """
        # Needs to satisfy isinstance(installation, CursorAgentIntegration) in
        # production code, so this stays a real spec'd Mock rather than the plain
        # FakeCodingAgentInstallation (which doesn't subclass the real ABC).
        mock_installation = MagicMock(spec=CursorAgentIntegration)
        mock_installation.launch.side_effect = ApiError(
            text='{"error":"Failed to verify existence of branch \'main\' in repository owner/repo. Please ensure the branch name is correct."}',
            code=400,
        )
        mock_validate.return_value = (None, mock_installation)

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


MOCK_HANDOFF_PATH = "sentry.seer.agent.coding_agent_handoff"


class TestResolveClient(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()

    @patch(f"{MOCK_HANDOFF_PATH}.validate_and_get_integration")
    def test_returns_installation_for_cursor(self, mock_validate):
        mock_installation = MagicMock()
        mock_validate.return_value = (None, mock_installation)

        client, installation = _resolve_client(
            self.organization, integration_id=1, provider=None, user_id=None
        )

        assert client is None
        assert installation is mock_installation
        mock_validate.assert_called_once_with(self.organization, 1)

    @patch(f"{MOCK_HANDOFF_PATH}.validate_and_get_integration")
    def test_returns_installation_for_claude_code(self, mock_validate):
        mock_installation = MagicMock()
        mock_validate.return_value = (None, mock_installation)

        client, installation = _resolve_client(
            self.organization, integration_id=1, provider=None, user_id=None
        )

        assert client is None
        assert installation is mock_installation

    @patch(f"{MOCK_HANDOFF_PATH}.github_copilot_identity_service")
    def test_returns_client_for_github_copilot(self, mock_identity_service):
        mock_identity_service.get_access_token_for_user.return_value = "test-token"

        client, installation = _resolve_client(
            self.organization, integration_id=None, provider="github_copilot", user_id=1
        )

        assert client is not None
        assert installation is None
        mock_identity_service.get_access_token_for_user.assert_called_once_with(user_id=1)

    @patch(f"{MOCK_HANDOFF_PATH}.github_copilot_identity_service")
    def test_raises_permission_denied_when_no_copilot_token(self, mock_identity_service):
        mock_identity_service.get_access_token_for_user.return_value = None

        with pytest.raises(PermissionDenied):
            _resolve_client(
                self.organization, integration_id=None, provider="github_copilot", user_id=1
            )

    def test_raises_permission_denied_when_copilot_no_user_id(self):
        with pytest.raises(PermissionDenied):
            _resolve_client(
                self.organization, integration_id=None, provider="github_copilot", user_id=None
            )

    def test_raises_validation_error_when_no_integration_or_provider(self) -> None:
        with pytest.raises(ValidationError):
            _resolve_client(self.organization, integration_id=None, provider=None, user_id=None)
