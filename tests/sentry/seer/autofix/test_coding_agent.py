from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

from sentry.integrations.claude_code.utils import ClaudeSessionEvent
from sentry.integrations.cursor.integration import CursorAgentIntegration
from sentry.integrations.github_copilot.models import (
    GithubCopilotArtifact,
    GithubCopilotArtifactData,
    GithubCopilotTask,
)
from sentry.seer.autofix.coding_agent import (
    _launch_agents_for_repos,
    extract_result_from_events,
    poll_claude_code_agents,
    poll_github_copilot_agents,
)
from sentry.seer.autofix.utils import (
    AutofixRequest,
    AutofixState,
    AutofixTriggerSource,
    CodingAgentProviderType,
    CodingAgentState,
    CodingAgentStatus,
)
from sentry.seer.models import SeerApiError, SeerRepoDefinition
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import TestCase


class TestLaunchAgentsForRepos(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.run_id = 12345

        # Create a basic autofix state with a solution that references a repo
        self.autofix_state = AutofixState(
            run_id=self.run_id,
            request=AutofixRequest(
                organization_id=self.organization.id,
                project_id=self.project.id,
                issue={"id": 1, "title": "Test Issue"},
                repos=[
                    SeerRepoDefinition(
                        provider="github",
                        owner="getsentry",
                        name="sentry",
                        external_id="123456",
                    )
                ],
            ),
            updated_at=datetime.now(UTC),
            status="COMPLETED",
            steps=[
                {
                    "key": "solution",
                    "solution": [
                        {
                            "relevant_code_file": {
                                "repo_name": "getsentry/sentry",
                                "file_path": "test.py",
                            }
                        }
                    ],
                }
            ],
        )

    @patch("sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    def test_auto_create_pr_defaults_to_false_on_seer_api_error(
        self, mock_get_preferences, mock_get_prompt, mock_store_states
    ):
        """Test that auto_create_pr defaults to False when get_project_seer_preferences raises SeerApiError."""
        # Setup: Mock get_project_seer_preferences to raise SeerApiError
        mock_get_preferences.side_effect = SeerApiError("API Error", 500)

        # Mock the prompt response
        mock_get_prompt.return_value = "Test prompt"

        # Mock the installation and its launch method
        mock_installation = MagicMock()
        mock_installation.launch.return_value = {
            "url": "https://example.com/agent",
            "id": "agent-123",
        }

        # Call the function
        _launch_agents_for_repos(
            installation=mock_installation,
            autofix_state=self.autofix_state,
            run_id=self.run_id,
            organization=self.organization,
            trigger_source=AutofixTriggerSource.SOLUTION,
        )

        # Assert: Verify that launch was called with auto_create_pr=False
        assert mock_installation.launch.called
        launch_request = mock_installation.launch.call_args[0][0]
        assert launch_request.auto_create_pr is False

        # Verify that get_project_seer_preferences was called
        mock_get_preferences.assert_called_once_with(self.project.id)

    @patch("sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    def test_auto_create_pr_uses_preference_when_available(
        self, mock_get_preferences, mock_get_prompt, mock_store_states
    ):
        """Test that auto_create_pr uses the preference value when available."""
        from sentry.seer.models import (
            AutofixHandoffPoint,
            PreferenceResponse,
            SeerAutomationHandoffConfiguration,
            SeerProjectPreference,
        )

        # Setup: Mock get_project_seer_preferences to return a preference with auto_create_pr=True
        preference = SeerProjectPreference(
            organization_id=self.organization.id,
            project_id=self.project.id,
            repositories=[
                SeerRepoDefinition(
                    provider="github",
                    owner="getsentry",
                    name="sentry",
                    external_id="123456",
                )
            ],
            automation_handoff=SeerAutomationHandoffConfiguration(
                handoff_point=AutofixHandoffPoint.ROOT_CAUSE,
                target="cursor_background_agent",
                integration_id=123,
                auto_create_pr=True,
            ),
        )
        mock_get_preferences.return_value = PreferenceResponse(
            preference=preference, code_mapping_repos=[]
        )

        # Mock the prompt response
        mock_get_prompt.return_value = "Test prompt"

        # Mock the installation and its launch method
        mock_installation = MagicMock()
        mock_installation.launch.return_value = {
            "url": "https://example.com/agent",
            "id": "agent-123",
        }

        # Call the function
        _launch_agents_for_repos(
            installation=mock_installation,
            autofix_state=self.autofix_state,
            run_id=self.run_id,
            organization=self.organization,
            trigger_source=AutofixTriggerSource.SOLUTION,
        )

        # Assert: Verify that launch was called with auto_create_pr=True
        assert mock_installation.launch.called
        launch_request = mock_installation.launch.call_args[0][0]
        assert launch_request.auto_create_pr is True

    @patch("sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    def test_auto_create_pr_defaults_to_false_when_no_preference(
        self, mock_get_preferences, mock_get_prompt, mock_store_states
    ):
        """Test that auto_create_pr defaults to False when preference is None."""
        from sentry.seer.models import PreferenceResponse

        # Setup: Mock get_project_seer_preferences to return None preference
        mock_get_preferences.return_value = PreferenceResponse(
            preference=None, code_mapping_repos=[]
        )

        # Mock the prompt response
        mock_get_prompt.return_value = "Test prompt"

        # Mock the installation and its launch method
        mock_installation = MagicMock()
        mock_installation.launch.return_value = {
            "url": "https://example.com/agent",
            "id": "agent-123",
        }

        # Call the function
        _launch_agents_for_repos(
            installation=mock_installation,
            autofix_state=self.autofix_state,
            run_id=self.run_id,
            organization=self.organization,
            trigger_source=AutofixTriggerSource.SOLUTION,
        )

        # Assert: Verify that launch was called with auto_create_pr=False
        assert mock_installation.launch.called
        launch_request = mock_installation.launch.call_args[0][0]
        assert launch_request.auto_create_pr is False

    @patch("sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    def test_auto_create_pr_defaults_to_false_when_no_automation_handoff(
        self, mock_get_preferences, mock_get_prompt, mock_store_states
    ):
        """Test that auto_create_pr defaults to False when automation_handoff is None."""
        from sentry.seer.models import PreferenceResponse, SeerProjectPreference

        # Setup: Mock get_project_seer_preferences to return preference without automation_handoff
        preference = SeerProjectPreference(
            organization_id=self.organization.id,
            project_id=self.project.id,
            repositories=[
                SeerRepoDefinition(
                    provider="github",
                    owner="getsentry",
                    name="sentry",
                    external_id="123456",
                )
            ],
            automation_handoff=None,
        )
        mock_get_preferences.return_value = PreferenceResponse(
            preference=preference, code_mapping_repos=[]
        )

        # Mock the prompt response
        mock_get_prompt.return_value = "Test prompt"

        # Mock the installation and its launch method
        mock_installation = MagicMock()
        mock_installation.launch.return_value = {
            "url": "https://example.com/agent",
            "id": "agent-123",
        }

        # Call the function
        _launch_agents_for_repos(
            installation=mock_installation,
            autofix_state=self.autofix_state,
            run_id=self.run_id,
            organization=self.organization,
            trigger_source=AutofixTriggerSource.SOLUTION,
        )

        # Assert: Verify that launch was called with auto_create_pr=False
        assert mock_installation.launch.called
        launch_request = mock_installation.launch.call_args[0][0]
        assert launch_request.auto_create_pr is False

    @patch("sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    def test_api_error_401_includes_credentials_message(
        self, mock_get_preferences, mock_get_prompt, mock_store_states
    ):
        """Test that 401 ApiError failures include credentials hint in error message."""
        mock_get_preferences.side_effect = SeerApiError("API Error", 500)
        mock_get_prompt.return_value = "Test prompt"

        mock_installation = MagicMock()
        mock_installation.launch.side_effect = ApiError(
            text='{"code":"internal","message":"Error"}',
            code=401,
            url="https://api.cursor.com/v0/agents",
        )

        result = _launch_agents_for_repos(
            installation=mock_installation,
            autofix_state=self.autofix_state,
            run_id=self.run_id,
            organization=self.organization,
            trigger_source=AutofixTriggerSource.SOLUTION,
        )

        assert len(result["failures"]) == 1
        assert result["failures"][0]["repo_name"] == "getsentry/sentry"
        error_message = result["failures"][0]["error_message"]
        assert "Failed to make request to coding agent" in error_message
        assert "https://api.cursor.com/v0/agents" in error_message
        assert "Please check that your API credentials are correct" in error_message
        assert "401" in error_message
        assert '{"code":"internal","message":"Error"}' in error_message

    @patch("sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    def test_verify_branch_error_returns_cursor_github_access_failure_type(
        self, mock_get_preferences, mock_get_prompt, mock_store_states
    ):
        """Test that a 400 ApiError with 'Failed to verify existence of branch' returns cursor_github_access failure_type."""
        mock_get_preferences.side_effect = SeerApiError("API Error", 500)
        mock_get_prompt.return_value = "Test prompt"

        mock_installation = MagicMock(spec=CursorAgentIntegration)
        mock_installation.launch.side_effect = ApiError(
            text='{"error":"Failed to verify existence of branch \'main\' in repository owner/repo. Please ensure the branch name is correct."}',
            code=400,
        )

        result = _launch_agents_for_repos(
            installation=mock_installation,
            autofix_state=self.autofix_state,
            run_id=self.run_id,
            organization=self.organization,
            trigger_source=AutofixTriggerSource.SOLUTION,
        )

        assert len(result["failures"]) == 1
        failure = result["failures"][0]
        assert failure["failure_type"] == "cursor_github_access"
        assert "Cursor does not have GitHub access" in failure["error_message"]
        assert "install the Cursor GitHub App" in failure["error_message"]

    @patch("sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    def test_api_error_non_401_includes_status_code(
        self, mock_get_preferences, mock_get_prompt, mock_store_states
    ):
        """Test that non-401 ApiError failures include status code in error message."""
        mock_get_preferences.side_effect = SeerApiError("API Error", 500)
        mock_get_prompt.return_value = "Test prompt"

        mock_installation = MagicMock()
        mock_installation.launch.side_effect = ApiError(
            text="Some error message",
            code=500,
        )

        result = _launch_agents_for_repos(
            installation=mock_installation,
            autofix_state=self.autofix_state,
            run_id=self.run_id,
            organization=self.organization,
            trigger_source=AutofixTriggerSource.SOLUTION,
        )

        assert len(result["failures"]) == 1
        error_message = result["failures"][0]["error_message"]
        assert (
            error_message == "Failed to make request to coding agent. 500 Error: Some error message"
        )

    @patch("sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    def test_short_id_passed_to_prompt(
        self, mock_get_preferences, mock_get_prompt, mock_store_states
    ):
        """Test that short_id is passed to get_coding_agent_prompt."""
        from sentry.seer.models import (
            AutofixHandoffPoint,
            PreferenceResponse,
            SeerAutomationHandoffConfiguration,
            SeerProjectPreference,
        )

        self.autofix_state.request.issue["short_id"] = "AIML-2301"

        # Setup: Mock preferences with auto_create_pr=True
        preference = SeerProjectPreference(
            organization_id=self.organization.id,
            project_id=self.project.id,
            repositories=[
                SeerRepoDefinition(
                    provider="github",
                    owner="getsentry",
                    name="sentry",
                    external_id="123456",
                )
            ],
            automation_handoff=SeerAutomationHandoffConfiguration(
                handoff_point=AutofixHandoffPoint.ROOT_CAUSE,
                target="cursor_background_agent",
                integration_id=123,
                auto_create_pr=False,
            ),
        )
        mock_get_preferences.return_value = PreferenceResponse(
            preference=preference, code_mapping_repos=[]
        )

        mock_get_prompt.return_value = "Test prompt with Fixes AIML-2301"

        mock_installation = MagicMock()
        mock_installation.launch.return_value = {
            "url": "https://example.com/agent",
            "id": "agent-123",
        }

        _launch_agents_for_repos(
            installation=mock_installation,
            autofix_state=self.autofix_state,
            run_id=self.run_id,
            organization=self.organization,
            trigger_source=AutofixTriggerSource.SOLUTION,
        )

        # Assert: Verify get_coding_agent_prompt was called with the short_id
        mock_get_prompt.assert_called_once()
        call_args = mock_get_prompt.call_args
        assert call_args[0][3] == "AIML-2301"


class TestPollGithubCopilotAgents(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.user = self.create_user()
        self.run_id = 12345

    def _create_autofix_state_with_agents(
        self, agents: dict[str, CodingAgentState]
    ) -> AutofixState:
        return AutofixState(
            run_id=self.run_id,
            request=AutofixRequest(
                organization_id=self.organization.id,
                project_id=self.project.id,
                issue={"id": 1, "title": "Test Issue"},
                repos=[
                    SeerRepoDefinition(
                        provider="github",
                        owner="getsentry",
                        name="sentry",
                        external_id="123456",
                    )
                ],
            ),
            updated_at=datetime.now(UTC),
            status="COMPLETED",
            steps=[],
            coding_agents=agents,
        )

    def test_poll_skips_when_no_coding_agents(self) -> None:
        """Test that polling does nothing when there are no coding agents"""
        autofix_state = self._create_autofix_state_with_agents({})

        # Should not raise and should not call any external services
        poll_github_copilot_agents(autofix_state, user_id=self.user.id)

    def test_poll_skips_non_github_copilot_agents(self) -> None:
        """Test that polling skips agents that are not GitHub Copilot agents"""
        agents = {
            "cursor-agent-123": CodingAgentState(
                id="cursor-agent-123",
                status=CodingAgentStatus.RUNNING,
                provider=CodingAgentProviderType.CURSOR_BACKGROUND_AGENT,
                name="Cursor",
                started_at=datetime.now(UTC),
            )
        }
        autofix_state = self._create_autofix_state_with_agents(agents)

        # Should not raise and should not call any external services
        poll_github_copilot_agents(autofix_state, user_id=self.user.id)

    def test_poll_skips_completed_agents(self) -> None:
        """Test that polling skips agents that are already completed"""
        agents = {
            "getsentry:sentry:task-123": CodingAgentState(
                id="getsentry:sentry:task-123",
                status=CodingAgentStatus.COMPLETED,
                provider=CodingAgentProviderType.GITHUB_COPILOT_AGENT,
                name="GitHub Copilot",
                started_at=datetime.now(UTC),
            )
        }
        autofix_state = self._create_autofix_state_with_agents(agents)

        # Should not raise and should not call any external services
        poll_github_copilot_agents(autofix_state, user_id=self.user.id)

    @patch("sentry.seer.autofix.coding_agent.github_copilot_identity_service")
    def test_poll_returns_early_when_no_user_token(self, mock_identity_service):
        """Test that polling returns early when user has no access token"""
        mock_identity_service.get_access_token_for_user.return_value = None

        agents = {
            "getsentry:sentry:task-123": CodingAgentState(
                id="getsentry:sentry:task-123",
                status=CodingAgentStatus.RUNNING,
                provider=CodingAgentProviderType.GITHUB_COPILOT_AGENT,
                name="GitHub Copilot",
                started_at=datetime.now(UTC),
            )
        }
        autofix_state = self._create_autofix_state_with_agents(agents)

        poll_github_copilot_agents(autofix_state, user_id=self.user.id)

        mock_identity_service.get_access_token_for_user.assert_called_once_with(
            user_id=self.user.id
        )

    @patch("sentry.seer.autofix.coding_agent.update_coding_agent_state")
    @patch("sentry.seer.autofix.coding_agent.github_copilot_identity_service")
    def test_poll_updates_state_when_pr_created(self, mock_identity_service, mock_update_state):
        """Test that polling updates agent state when a PR is found"""
        from sentry.integrations.github_copilot.client import GithubCopilotAgentClient

        mock_identity_service.get_access_token_for_user.return_value = "test_token"

        mock_client = MagicMock()
        mock_client.get_task_status.return_value = GithubCopilotTask(
            id="task-123",
            state="completed",
            artifacts=[
                GithubCopilotArtifact(
                    provider="github",
                    type="pull_request",
                    data=GithubCopilotArtifactData(id=456, type="pull", global_id="PR_abc123"),
                )
            ],
        )

        mock_pr_info = MagicMock()
        mock_pr_info.url = "https://github.com/getsentry/sentry/pull/12345"
        mock_pr_info.title = "Fix the bug"
        mock_client.get_pr_from_graphql.return_value = mock_pr_info

        agents = {
            "getsentry:sentry:task-123": CodingAgentState(
                id="getsentry:sentry:task-123",
                status=CodingAgentStatus.RUNNING,
                provider=CodingAgentProviderType.GITHUB_COPILOT_AGENT,
                name="GitHub Copilot",
                started_at=datetime.now(UTC),
            )
        }
        autofix_state = self._create_autofix_state_with_agents(agents)

        with patch.object(GithubCopilotAgentClient, "__init__", return_value=None):
            with patch.object(
                GithubCopilotAgentClient, "get_task_status", mock_client.get_task_status
            ):
                with patch.object(
                    GithubCopilotAgentClient, "get_pr_from_graphql", mock_client.get_pr_from_graphql
                ):
                    poll_github_copilot_agents(autofix_state, user_id=self.user.id)

        mock_client.get_task_status.assert_called_once_with("getsentry", "sentry", "task-123")
        mock_client.get_pr_from_graphql.assert_called_once_with("PR_abc123")
        mock_update_state.assert_called_once()

        call_kwargs = mock_update_state.call_args[1]
        assert call_kwargs["agent_id"] == "getsentry:sentry:task-123"
        assert call_kwargs["status"] == CodingAgentStatus.COMPLETED
        assert call_kwargs["result"].pr_url == "https://github.com/getsentry/sentry/pull/12345"
        assert call_kwargs["result"].description == "Fix the bug"
        assert call_kwargs["result"].repo_full_name == "getsentry/sentry"

    @patch("sentry.seer.autofix.coding_agent.update_coding_agent_state")
    @patch("sentry.seer.autofix.coding_agent.github_copilot_identity_service")
    def test_poll_marks_agent_failed_on_error_status(
        self, mock_identity_service, mock_update_state
    ):
        """Test that polling marks agent as failed when task status is error"""
        from sentry.integrations.github_copilot.client import GithubCopilotAgentClient

        mock_identity_service.get_access_token_for_user.return_value = "test_token"

        mock_get_task_status = MagicMock(
            return_value=GithubCopilotTask(
                id="task-123",
                state="failed",
            )
        )

        agents = {
            "getsentry:sentry:task-123": CodingAgentState(
                id="getsentry:sentry:task-123",
                status=CodingAgentStatus.RUNNING,
                provider=CodingAgentProviderType.GITHUB_COPILOT_AGENT,
                name="GitHub Copilot",
                started_at=datetime.now(UTC),
            )
        }
        autofix_state = self._create_autofix_state_with_agents(agents)

        with patch.object(GithubCopilotAgentClient, "__init__", return_value=None):
            with patch.object(GithubCopilotAgentClient, "get_task_status", mock_get_task_status):
                poll_github_copilot_agents(autofix_state, user_id=self.user.id)

        mock_update_state.assert_called_once_with(
            agent_id="getsentry:sentry:task-123",
            status=CodingAgentStatus.FAILED,
        )

    @patch("sentry.seer.autofix.coding_agent.update_coding_agent_state")
    @patch("sentry.seer.autofix.coding_agent.github_copilot_identity_service")
    def test_poll_keeps_running_status_when_task_not_done(
        self, mock_identity_service, mock_update_state
    ):
        """Test that polling keeps RUNNING status when task is still in progress"""
        from sentry.integrations.github_copilot.client import GithubCopilotAgentClient

        mock_identity_service.get_access_token_for_user.return_value = "test_token"

        mock_get_task_status = MagicMock(
            return_value=GithubCopilotTask(
                id="task-123",
                state="in_progress",
                artifacts=[
                    GithubCopilotArtifact(
                        provider="github",
                        type="pull_request",
                        data=GithubCopilotArtifactData(id=456, type="pull", global_id="PR_abc123"),
                    )
                ],
            )
        )

        mock_pr_info = MagicMock()
        mock_pr_info.url = "https://github.com/getsentry/sentry/pull/12345"
        mock_pr_info.title = "Fix the bug"
        mock_get_pr_from_graphql = MagicMock(return_value=mock_pr_info)

        agents = {
            "getsentry:sentry:task-123": CodingAgentState(
                id="getsentry:sentry:task-123",
                status=CodingAgentStatus.RUNNING,
                provider=CodingAgentProviderType.GITHUB_COPILOT_AGENT,
                name="GitHub Copilot",
                started_at=datetime.now(UTC),
            )
        }
        autofix_state = self._create_autofix_state_with_agents(agents)

        with patch.object(GithubCopilotAgentClient, "__init__", return_value=None):
            with patch.object(GithubCopilotAgentClient, "get_task_status", mock_get_task_status):
                with patch.object(
                    GithubCopilotAgentClient, "get_pr_from_graphql", mock_get_pr_from_graphql
                ):
                    poll_github_copilot_agents(autofix_state, user_id=self.user.id)

        mock_update_state.assert_called_once()
        call_kwargs = mock_update_state.call_args[1]
        assert call_kwargs["status"] == CodingAgentStatus.RUNNING

    @patch("sentry.seer.autofix.coding_agent.update_coding_agent_state")
    @patch("sentry.seer.autofix.coding_agent.github_copilot_identity_service")
    def test_poll_handles_api_exception(self, mock_identity_service, mock_update_state):
        """Test that polling handles exceptions gracefully"""
        from sentry.integrations.github_copilot.client import GithubCopilotAgentClient

        mock_identity_service.get_access_token_for_user.return_value = "test_token"

        mock_get_task_status = MagicMock(side_effect=Exception("API Error"))

        agents = {
            "getsentry:sentry:task-123": CodingAgentState(
                id="getsentry:sentry:task-123",
                status=CodingAgentStatus.RUNNING,
                provider=CodingAgentProviderType.GITHUB_COPILOT_AGENT,
                name="GitHub Copilot",
                started_at=datetime.now(UTC),
            )
        }
        autofix_state = self._create_autofix_state_with_agents(agents)

        with patch.object(GithubCopilotAgentClient, "__init__", return_value=None):
            with patch.object(GithubCopilotAgentClient, "get_task_status", mock_get_task_status):
                # Should not raise - exception should be caught and logged
                poll_github_copilot_agents(autofix_state, user_id=self.user.id)

        # State should not be updated when there's an error
        mock_update_state.assert_not_called()

    def test_poll_skips_invalid_agent_id(self) -> None:
        """Test that polling skips agents with invalid IDs"""
        agents = {
            "invalid-agent-id": CodingAgentState(
                id="invalid-agent-id",
                status=CodingAgentStatus.RUNNING,
                provider=CodingAgentProviderType.GITHUB_COPILOT_AGENT,
                name="GitHub Copilot",
                started_at=datetime.now(UTC),
            )
        }
        autofix_state = self._create_autofix_state_with_agents(agents)

        # Should not raise - invalid agent ID should be skipped
        poll_github_copilot_agents(autofix_state, user_id=self.user.id)


MOCK_CLIENT_CLASS_PATH = "sentry.seer.autofix.coding_agent.import_string"
MOCK_INTEGRATION_SERVICE_PATH = "sentry.seer.autofix.coding_agent.integration_service"
MOCK_UPDATE_STATE_PATH = "sentry.seer.autofix.coding_agent.update_coding_agent_state"
MOCK_DJANGO_SETTINGS_PATH = "sentry.seer.autofix.coding_agent.django_settings"


def _make_agent_event(text: str) -> ClaudeSessionEvent:
    return ClaudeSessionEvent(type="agent", content=[{"type": "text", "text": text}])


class TestExtractResultFromEvents(TestCase):
    def test_extracts_pr_url(self) -> None:
        text = "PR created: https://github.com/org/repo/pull/123"
        events = [_make_agent_event(text)]
        url, block = extract_result_from_events(events)
        assert url == "https://github.com/org/repo/pull/123"
        assert block == text

    def test_extracts_branch_url(self) -> None:
        text = "Pushed to https://github.com/org/repo/tree/my-branch"
        events = [_make_agent_event(text)]
        url, block = extract_result_from_events(events)
        assert url == "https://github.com/org/repo/tree/my-branch"
        assert block == text

    def test_strips_trailing_period(self) -> None:
        events = [_make_agent_event("See https://github.com/org/repo/tree/my-branch.")]
        url, _ = extract_result_from_events(events)
        assert url == "https://github.com/org/repo/tree/my-branch"

    def test_strips_trailing_comma(self) -> None:
        events = [_make_agent_event("https://github.com/org/repo/tree/my-branch, ready")]
        url, _ = extract_result_from_events(events)
        assert url == "https://github.com/org/repo/tree/my-branch"

    def test_branch_with_slashes(self) -> None:
        events = [_make_agent_event("https://github.com/org/repo/tree/feat/sub/thing")]
        url, _ = extract_result_from_events(events)
        assert url == "https://github.com/org/repo/tree/feat/sub/thing"

    def test_branch_with_dots_in_name(self) -> None:
        events = [_make_agent_event("https://github.com/org/repo/tree/v1.2.3-fix")]
        url, _ = extract_result_from_events(events)
        assert url == "https://github.com/org/repo/tree/v1.2.3-fix"

    def test_pr_preferred_over_branch(self) -> None:
        events = [
            _make_agent_event(
                "Branch https://github.com/org/repo/tree/my-branch "
                "and PR https://github.com/org/repo/pull/42"
            )
        ]
        url, _ = extract_result_from_events(events)
        assert url == "https://github.com/org/repo/pull/42"

    def test_returns_none_when_no_url(self) -> None:
        events = [_make_agent_event("All done, no link.")]
        url, block = extract_result_from_events(events)
        assert url is None
        assert block is None

    def test_returns_none_for_empty_events(self) -> None:
        url, block = extract_result_from_events([])
        assert url is None
        assert block is None

    def test_searches_most_recent_event_first(self) -> None:
        events = [
            _make_agent_event("https://github.com/org/repo/tree/old-branch"),
            _make_agent_event("https://github.com/org/repo/tree/new-branch"),
        ]
        url, _ = extract_result_from_events(events)
        assert url == "https://github.com/org/repo/tree/new-branch"

    def test_skips_non_agent_events(self) -> None:
        events = [
            ClaudeSessionEvent(
                type="tool_result",
                content=[{"type": "text", "text": "https://github.com/org/repo/pull/1"}],
            ),
            _make_agent_event("No URL here"),
        ]
        url, block = extract_result_from_events(events)
        assert url is None
        assert block is None


class TestPollClaudeCodeAgents(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.run_id = 12345
        self.integration_id = 99

        patcher = patch(MOCK_DJANGO_SETTINGS_PATH)
        self.mock_settings = patcher.start()
        self.mock_settings.CLAUDE_CODE_CLIENT_CLASS = "test.MockClaudeCodeClient"
        self.addCleanup(patcher.stop)

    def _create_autofix_state_with_agents(
        self, agents: dict[str, CodingAgentState]
    ) -> AutofixState:
        return AutofixState(
            run_id=self.run_id,
            request=AutofixRequest(
                organization_id=self.organization.id,
                project_id=self.project.id,
                issue={"id": 1, "title": "Test Issue"},
                repos=[
                    SeerRepoDefinition(
                        provider="github",
                        owner="getsentry",
                        name="sentry",
                        external_id="123456",
                    )
                ],
            ),
            updated_at=datetime.now(UTC),
            status="COMPLETED",
            steps=[],
            coding_agents=agents,
        )

    def _create_claude_agent(
        self, agent_id="claude-session-123", status=CodingAgentStatus.RUNNING
    ) -> CodingAgentState:
        return CodingAgentState(
            id=agent_id,
            status=status,
            provider=CodingAgentProviderType.CLAUDE_CODE_AGENT,
            name="getsentry/sentry: Claude Agent",
            started_at=datetime.now(UTC),
            integration_id=self.integration_id,
        )

    def _mock_integration(self, mock_integration_service):
        mock_integration = MagicMock()
        mock_integration.metadata = {
            "api_key": "sk-ant-test",
            "environment_id": "env-123",
            "workspace_name": "test-workspace",
        }
        mock_integration_service.get_integration.return_value = mock_integration
        return mock_integration

    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_skips_when_no_coding_agents(self, mock_integration_service):
        autofix_state = self._create_autofix_state_with_agents({})
        poll_claude_code_agents(autofix_state=autofix_state)
        mock_integration_service.get_integration.assert_not_called()

    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_skips_non_claude_agents(self, mock_integration_service):
        agents = {
            "cursor-agent-123": CodingAgentState(
                id="cursor-agent-123",
                status=CodingAgentStatus.RUNNING,
                provider=CodingAgentProviderType.CURSOR_BACKGROUND_AGENT,
                name="Cursor",
                started_at=datetime.now(UTC),
            )
        }
        autofix_state = self._create_autofix_state_with_agents(agents)
        poll_claude_code_agents(autofix_state=autofix_state)
        mock_integration_service.get_integration.assert_not_called()

    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_skips_completed_agents(self, mock_integration_service):
        agents = {
            "claude-session-123": self._create_claude_agent(status=CodingAgentStatus.COMPLETED),
        }
        autofix_state = self._create_autofix_state_with_agents(agents)
        poll_claude_code_agents(autofix_state=autofix_state)
        mock_integration_service.get_integration.assert_not_called()

    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_skips_failed_agents(self, mock_integration_service):
        agents = {
            "claude-session-123": self._create_claude_agent(status=CodingAgentStatus.FAILED),
        }
        autofix_state = self._create_autofix_state_with_agents(agents)
        poll_claude_code_agents(autofix_state=autofix_state)
        mock_integration_service.get_integration.assert_not_called()

    @patch(MOCK_UPDATE_STATE_PATH)
    @patch(MOCK_CLIENT_CLASS_PATH)
    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_polls_running_agent_and_updates_completed(
        self, mock_integration_service, mock_import_string, mock_update_state
    ):
        self._mock_integration(mock_integration_service)
        mock_client = MagicMock()
        mock_client.list_session_events.return_value = [
            {
                "type": "agent",
                "content": [
                    {
                        "type": "text",
                        "text": "PR created: https://github.com/getsentry/sentry/pull/999",
                    }
                ],
            },
            {"type": "status_idle"},
        ]
        mock_client.build_result_from_session.return_value = MagicMock(
            pr_url="https://github.com/getsentry/sentry/pull/999"
        )
        mock_import_string.return_value = lambda **kwargs: mock_client

        agents = {"claude-session-123": self._create_claude_agent()}
        autofix_state = self._create_autofix_state_with_agents(agents)
        poll_claude_code_agents(autofix_state=autofix_state)

        mock_client.list_session_events.assert_called_once_with("claude-session-123")
        mock_update_state.assert_called_once()
        call_kwargs = mock_update_state.call_args[1]
        assert call_kwargs["agent_id"] == "claude-session-123"
        assert call_kwargs["status"] == CodingAgentStatus.COMPLETED

    @patch(MOCK_UPDATE_STATE_PATH)
    @patch(MOCK_CLIENT_CLASS_PATH)
    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_marks_failed_when_no_pr_url(
        self, mock_integration_service, mock_import_string, mock_update_state
    ):
        self._mock_integration(mock_integration_service)
        mock_client = MagicMock()
        mock_client.list_session_events.return_value = [
            {"type": "agent", "content": [{"type": "text", "text": "Done, no PR."}]},
            {"type": "status_idle"},
        ]
        mock_client.build_result_from_session.return_value = MagicMock(pr_url=None)
        mock_import_string.return_value = lambda **kwargs: mock_client

        agents = {"claude-session-123": self._create_claude_agent()}
        autofix_state = self._create_autofix_state_with_agents(agents)
        poll_claude_code_agents(autofix_state=autofix_state)

        mock_update_state.assert_called_once()
        call_kwargs = mock_update_state.call_args[1]
        assert call_kwargs["status"] == CodingAgentStatus.FAILED

    @patch(MOCK_UPDATE_STATE_PATH)
    @patch(MOCK_CLIENT_CLASS_PATH)
    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_no_update_when_status_unchanged(
        self, mock_integration_service, mock_import_string, mock_update_state
    ):
        self._mock_integration(mock_integration_service)
        mock_client = MagicMock()
        # Last event is status_running — agent is already RUNNING, no update needed
        mock_client.list_session_events.return_value = [{"type": "status_running"}]
        mock_import_string.return_value = lambda **kwargs: mock_client

        agents = {"claude-session-123": self._create_claude_agent()}
        autofix_state = self._create_autofix_state_with_agents(agents)
        poll_claude_code_agents(autofix_state=autofix_state)

        mock_update_state.assert_not_called()

    @patch(MOCK_UPDATE_STATE_PATH)
    @patch(MOCK_CLIENT_CLASS_PATH)
    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_no_update_when_events_empty(
        self, mock_integration_service, mock_import_string, mock_update_state
    ):
        self._mock_integration(mock_integration_service)
        mock_client = MagicMock()
        mock_client.list_session_events.return_value = []
        mock_import_string.return_value = lambda **kwargs: mock_client

        agents = {"claude-session-123": self._create_claude_agent()}
        autofix_state = self._create_autofix_state_with_agents(agents)
        poll_claude_code_agents(autofix_state=autofix_state)

        mock_update_state.assert_not_called()

    @patch(MOCK_UPDATE_STATE_PATH)
    @patch(MOCK_CLIENT_CLASS_PATH)
    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_updates_pending_to_running_on_non_idle_event(
        self, mock_integration_service, mock_import_string, mock_update_state
    ):
        self._mock_integration(mock_integration_service)
        mock_client = MagicMock()
        mock_client.list_session_events.return_value = [{"type": "agent", "content": []}]
        mock_import_string.return_value = lambda **kwargs: mock_client

        agents = {"claude-session-123": self._create_claude_agent(status=CodingAgentStatus.PENDING)}
        autofix_state = self._create_autofix_state_with_agents(agents)
        poll_claude_code_agents(autofix_state=autofix_state)

        mock_update_state.assert_called_once()
        call_kwargs = mock_update_state.call_args[1]
        assert call_kwargs["status"] == CodingAgentStatus.RUNNING

    @patch(MOCK_UPDATE_STATE_PATH)
    @patch(MOCK_CLIENT_CLASS_PATH)
    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_stays_pending_on_status_pending_event(
        self, mock_integration_service, mock_import_string, mock_update_state
    ):
        self._mock_integration(mock_integration_service)
        mock_client = MagicMock()
        mock_client.list_session_events.return_value = [{"type": "status_pending"}]
        mock_import_string.return_value = lambda **kwargs: mock_client

        agents = {"claude-session-123": self._create_claude_agent(status=CodingAgentStatus.PENDING)}
        autofix_state = self._create_autofix_state_with_agents(agents)
        poll_claude_code_agents(autofix_state=autofix_state)

        mock_update_state.assert_not_called()

    @patch(MOCK_UPDATE_STATE_PATH)
    @patch(MOCK_CLIENT_CLASS_PATH)
    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_uses_correct_integration_per_agent(
        self, mock_integration_service, mock_import_string, mock_update_state
    ):
        integration_a = MagicMock()
        integration_a.metadata = {
            "api_key": "sk-ant-aaa",
            "environment_id": "env-a",
            "workspace_name": "ws-a",
        }
        integration_b = MagicMock()
        integration_b.metadata = {
            "api_key": "sk-ant-bbb",
            "environment_id": "env-b",
            "workspace_name": "ws-b",
        }
        org_integration_a = MagicMock()
        org_integration_a.id = 1001
        org_integration_b = MagicMock()
        org_integration_b.id = 1002
        mock_integration_service.get_organization_integration.side_effect = (
            lambda organization_id, integration_id: {
                100: org_integration_a,
                200: org_integration_b,
            }[integration_id]
        )
        mock_integration_service.get_integration.side_effect = lambda organization_integration_id: {
            1001: integration_a,
            1002: integration_b,
        }[organization_integration_id]

        clients = {}

        def make_client(**kwargs):
            client = MagicMock()
            client.list_session_events.return_value = [{"type": "status_running"}]
            clients[kwargs["api_key"]] = client
            return client

        mock_import_string.return_value = make_client

        agent_a = CodingAgentState(
            id="session-a",
            status=CodingAgentStatus.RUNNING,
            provider=CodingAgentProviderType.CLAUDE_CODE_AGENT,
            name="Agent A",
            started_at=datetime.now(UTC),
            integration_id=100,
        )
        agent_b = CodingAgentState(
            id="session-b",
            status=CodingAgentStatus.RUNNING,
            provider=CodingAgentProviderType.CLAUDE_CODE_AGENT,
            name="Agent B",
            started_at=datetime.now(UTC),
            integration_id=200,
        )
        autofix_state = self._create_autofix_state_with_agents(
            {"session-a": agent_a, "session-b": agent_b}
        )
        poll_claude_code_agents(autofix_state=autofix_state)

        assert mock_integration_service.get_integration.call_count == 2
        assert len(clients) == 2
        clients["sk-ant-aaa"].list_session_events.assert_called_once_with("session-a")
        clients["sk-ant-bbb"].list_session_events.assert_called_once_with("session-b")

    @patch(MOCK_UPDATE_STATE_PATH)
    @patch(MOCK_CLIENT_CLASS_PATH)
    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_caches_client_for_same_integration(
        self, mock_integration_service, mock_import_string, mock_update_state
    ):
        self._mock_integration(mock_integration_service)
        mock_client = MagicMock()
        mock_client.list_session_events.return_value = [{"type": "status_running"}]
        mock_import_string.return_value = lambda **kwargs: mock_client

        agent_a = self._create_claude_agent(agent_id="session-a")
        agent_b = self._create_claude_agent(agent_id="session-b")
        autofix_state = self._create_autofix_state_with_agents(
            {"session-a": agent_a, "session-b": agent_b}
        )
        poll_claude_code_agents(autofix_state=autofix_state)

        mock_integration_service.get_integration.assert_called_once()
        assert mock_client.list_session_events.call_count == 2
