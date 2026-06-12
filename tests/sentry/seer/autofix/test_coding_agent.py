from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

from sentry.integrations.claude_code.utils import ClaudeSessionEvent, ClaudeSessionEventStatus
from sentry.integrations.github_copilot.client import GithubCopilotAgentClient
from sentry.integrations.github_copilot.models import (
    GithubCopilotArtifact,
    GithubCopilotArtifactData,
    GithubCopilotTask,
)
from sentry.models.pullrequest import PullRequestAttributionSignalType
from sentry.seer.autofix.coding_agent import (
    extract_result_from_events,
    poll_claude_code_agents,
    poll_github_copilot_agents,
)
from sentry.seer.autofix.utils import (
    AutofixRequest,
    AutofixState,
    CodingAgentProviderType,
    CodingAgentState,
    CodingAgentStatus,
)
from sentry.seer.models import SeerRepoDefinition
from sentry.testutils.cases import TestCase


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

    @patch("sentry.seer.autofix.coding_agent.attribute_delegated_agent_pull_request")
    @patch("sentry.seer.autofix.coding_agent.update_coding_agent_state")
    @patch("sentry.seer.autofix.coding_agent.github_copilot_identity_service")
    def test_poll_attributes_pr_when_task_complete(
        self, mock_identity_service, mock_update_state, mock_attribute
    ):
        """A completed Copilot task with a PR is attributed to the Copilot agent."""
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
                    poll_github_copilot_agents(
                        autofix_state,
                        user_id=self.user.id,
                        organization_id=self.organization.id,
                    )

        mock_attribute.assert_called_once_with(
            organization_id=self.organization.id,
            signal_type=PullRequestAttributionSignalType.SEER_DELEGATED_GITHUB_COPILOT,
            repo_full_name="getsentry/sentry",
            repo_provider="github",
            pr_url="https://github.com/getsentry/sentry/pull/12345",
            agent_id="getsentry:sentry:task-123",
        )

    @patch("sentry.seer.autofix.coding_agent.attribute_delegated_agent_pull_request")
    @patch("sentry.seer.autofix.coding_agent.update_coding_agent_state")
    @patch("sentry.seer.autofix.coding_agent.github_copilot_identity_service")
    def test_poll_does_not_attribute_when_task_not_done(
        self, mock_identity_service, mock_update_state, mock_attribute
    ):
        """A PR seen while the task is still running is not attributed yet."""
        mock_identity_service.get_access_token_for_user.return_value = "test_token"

        mock_client = MagicMock()
        mock_client.get_task_status.return_value = GithubCopilotTask(
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
        mock_pr_info = MagicMock()
        mock_pr_info.url = "https://github.com/getsentry/sentry/pull/12345"
        mock_pr_info.title = "WIP"
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
                    poll_github_copilot_agents(
                        autofix_state,
                        user_id=self.user.id,
                        organization_id=self.organization.id,
                    )

        mock_attribute.assert_not_called()

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
    return ClaudeSessionEvent(type="agent.message", content=[{"type": "text", "text": text}])


class TestExtractResultFromEvents(TestCase):
    def test_extracts_pr_url(self) -> None:
        text = "PR created: https://github.com/org/repo/pull/123"
        events = [_make_agent_event(text)]
        url, block, branch_name = extract_result_from_events(events)
        assert url == "https://github.com/org/repo/pull/123"
        assert block == text
        assert branch_name is None

    def test_extracts_branch_url(self) -> None:
        text = "Pushed to https://github.com/org/repo/tree/my-branch"
        events = [_make_agent_event(text)]
        url, block, branch_name = extract_result_from_events(events)
        assert url == "https://github.com/org/repo/tree/my-branch"
        assert block == text
        assert branch_name == "my-branch"

    def test_strips_trailing_period(self) -> None:
        events = [_make_agent_event("See https://github.com/org/repo/tree/my-branch.")]
        url, _, branch_name = extract_result_from_events(events)
        assert url == "https://github.com/org/repo/tree/my-branch"
        assert branch_name == "my-branch"

    def test_strips_trailing_comma(self) -> None:
        events = [_make_agent_event("https://github.com/org/repo/tree/my-branch, ready")]
        url, _, branch_name = extract_result_from_events(events)
        assert url == "https://github.com/org/repo/tree/my-branch"
        assert branch_name == "my-branch"

    def test_branch_with_slashes(self) -> None:
        events = [_make_agent_event("https://github.com/org/repo/tree/feat/sub/thing")]
        url, _, branch_name = extract_result_from_events(events)
        assert url == "https://github.com/org/repo/tree/feat/sub/thing"
        assert branch_name == "feat/sub/thing"

    def test_branch_with_dots_in_name(self) -> None:
        events = [_make_agent_event("https://github.com/org/repo/tree/v1.2.3-fix")]
        url, _, branch_name = extract_result_from_events(events)
        assert url == "https://github.com/org/repo/tree/v1.2.3-fix"
        assert branch_name == "v1.2.3-fix"

    def test_pr_preferred_over_branch(self) -> None:
        events = [
            _make_agent_event(
                "Branch https://github.com/org/repo/tree/my-branch "
                "and PR https://github.com/org/repo/pull/42"
            )
        ]
        url, _, branch_name = extract_result_from_events(events)
        assert url == "https://github.com/org/repo/pull/42"
        assert branch_name is None

    def test_returns_none_when_no_url(self) -> None:
        events = [_make_agent_event("All done, no link.")]
        url, block, branch_name = extract_result_from_events(events)
        assert url is None
        assert block is None
        assert branch_name is None

    def test_returns_none_for_empty_events(self) -> None:
        url, block, branch_name = extract_result_from_events([])
        assert url is None
        assert block is None
        assert branch_name is None

    def test_searches_most_recent_event_first(self) -> None:
        events = [
            _make_agent_event("https://github.com/org/repo/tree/old-branch"),
            _make_agent_event("https://github.com/org/repo/tree/new-branch"),
        ]
        url, _, branch_name = extract_result_from_events(events)
        assert url == "https://github.com/org/repo/tree/new-branch"
        assert branch_name == "new-branch"

    def test_skips_non_agent_events(self) -> None:
        events = [
            ClaudeSessionEvent(
                type="tool_result",
                content=[{"type": "text", "text": "https://github.com/org/repo/pull/1"}],
            ),
            _make_agent_event("No URL here"),
        ]
        url, block, branch_name = extract_result_from_events(events)
        assert url is None
        assert block is None
        assert branch_name is None


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
                "type": "agent.message",
                "content": [
                    {
                        "type": "text",
                        "text": "PR created: https://github.com/getsentry/sentry/pull/999",
                    }
                ],
            },
            {"type": ClaudeSessionEventStatus.IDLE},
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

    @patch("sentry.seer.autofix.coding_agent.attribute_delegated_agent_pull_request")
    @patch(MOCK_UPDATE_STATE_PATH)
    @patch(MOCK_CLIENT_CLASS_PATH)
    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_attributes_pr_on_completion(
        self, mock_integration_service, mock_import_string, mock_update_state, mock_attribute
    ):
        """A completed Claude session with a PR is attributed to the Claude agent."""
        self._mock_integration(mock_integration_service)
        mock_client = MagicMock()
        mock_client.list_session_events.return_value = [
            {
                "type": "agent.message",
                "content": [
                    {
                        "type": "text",
                        "text": "PR created: https://github.com/getsentry/sentry/pull/999",
                    }
                ],
            },
            {"type": ClaudeSessionEventStatus.IDLE},
        ]
        mock_client.build_result_from_session.return_value = MagicMock(
            pr_url="https://github.com/getsentry/sentry/pull/999",
            repo_full_name="getsentry/sentry",
            repo_provider="github",
        )
        mock_import_string.return_value = lambda **kwargs: mock_client

        agents = {"claude-session-123": self._create_claude_agent()}
        autofix_state = self._create_autofix_state_with_agents(agents)
        poll_claude_code_agents(autofix_state=autofix_state)

        mock_attribute.assert_called_once_with(
            organization_id=self.organization.id,
            signal_type=PullRequestAttributionSignalType.SEER_DELEGATED_CLAUDE_CODE,
            repo_full_name="getsentry/sentry",
            repo_provider="github",
            pr_url="https://github.com/getsentry/sentry/pull/999",
            agent_id="claude-session-123",
        )

    @patch("sentry.seer.autofix.coding_agent.attribute_delegated_agent_pull_request")
    @patch(MOCK_UPDATE_STATE_PATH)
    @patch(MOCK_CLIENT_CLASS_PATH)
    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_does_not_attribute_when_no_pr_url(
        self, mock_integration_service, mock_import_string, mock_update_state, mock_attribute
    ):
        """A completed session without a PR is not attributed."""
        self._mock_integration(mock_integration_service)
        mock_client = MagicMock()
        mock_client.list_session_events.return_value = [
            {"type": "agent.message", "content": [{"type": "text", "text": "Done, no PR."}]},
            {"type": ClaudeSessionEventStatus.IDLE},
        ]
        mock_import_string.return_value = lambda **kwargs: mock_client

        agents = {"claude-session-123": self._create_claude_agent()}
        autofix_state = self._create_autofix_state_with_agents(agents)
        poll_claude_code_agents(autofix_state=autofix_state)

        mock_attribute.assert_not_called()

    @patch(MOCK_UPDATE_STATE_PATH)
    @patch(MOCK_CLIENT_CLASS_PATH)
    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_marks_failed_when_no_pr_url(
        self, mock_integration_service, mock_import_string, mock_update_state
    ):
        self._mock_integration(mock_integration_service)
        mock_client = MagicMock()
        mock_client.list_session_events.return_value = [
            {"type": "agent.message", "content": [{"type": "text", "text": "Done, no PR."}]},
            {"type": ClaudeSessionEventStatus.IDLE},
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
        # Last event is session.status_running — agent is already RUNNING, no update needed
        mock_client.list_session_events.return_value = [{"type": ClaudeSessionEventStatus.RUNNING}]
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
        mock_client.list_session_events.return_value = [{"type": "agent.message", "content": []}]
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
    def test_stays_pending_on_status_rescheduling_event(
        self, mock_integration_service, mock_import_string, mock_update_state
    ):
        self._mock_integration(mock_integration_service)
        mock_client = MagicMock()
        mock_client.list_session_events.return_value = [
            {"type": ClaudeSessionEventStatus.RESCHEDULING}
        ]
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
            client.list_session_events.return_value = [{"type": ClaudeSessionEventStatus.RUNNING}]
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
        mock_client.list_session_events.return_value = [{"type": ClaudeSessionEventStatus.RUNNING}]
        mock_import_string.return_value = lambda **kwargs: mock_client

        agent_a = self._create_claude_agent(agent_id="session-a")
        agent_b = self._create_claude_agent(agent_id="session-b")
        autofix_state = self._create_autofix_state_with_agents(
            {"session-a": agent_a, "session-b": agent_b}
        )
        poll_claude_code_agents(autofix_state=autofix_state)

        mock_integration_service.get_integration.assert_called_once()
        assert mock_client.list_session_events.call_count == 2
