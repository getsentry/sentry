from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

from sentry.integrations.claude_code.utils import ClaudeSessionEvent, ClaudeSessionEventStatus
from sentry.integrations.github_copilot.client import GithubCopilotAgentClient
from sentry.integrations.github_copilot.models import (
    GithubCopilotArtifact,
    GithubCopilotArtifactData,
    GithubCopilotTask,
    GithubPullRequest,
)
from sentry.models.pullrequest import PullRequestAttributionSignalType
from sentry.seer.autofix.coding_agent import (
    extract_result_from_events,
    poll_claude_code_agents,
    poll_github_copilot_agents,
)
from sentry.seer.autofix.constants import CodingAgentStatus
from sentry.seer.autofix.utils import (
    AutofixRequest,
    AutofixState,
    CodingAgentProviderType,
    CodingAgentResult,
    CodingAgentState,
)
from sentry.seer.models import SeerRepoDefinition
from sentry.testutils.cases import TestCase

MOCK_SYNC_STATUS_PATH = "sentry.seer.autofix.coding_agent.sync_coding_agent_status"


class FakeGithubCopilotAgentClient:
    def __init__(
        self,
        task_status: GithubCopilotTask | None = None,
        task_status_error: Exception | None = None,
        pr_from_graphql: GithubPullRequest | None = None,
        pr_from_branch: GithubPullRequest | None = None,
        pr_from_branch_error: Exception | None = None,
    ) -> None:
        self.task_status = task_status
        self.task_status_error = task_status_error
        self.pr_from_graphql = pr_from_graphql
        self.pr_from_branch = pr_from_branch
        self.pr_from_branch_error = pr_from_branch_error
        self.get_task_status_calls: list[tuple[str, str, str]] = []
        self.get_pr_from_graphql_calls: list[str] = []
        self.get_pr_from_branch_calls: list[tuple[str, str, str]] = []

    def get_task_status(self, owner: str, repo: str, task_id: str) -> GithubCopilotTask:
        self.get_task_status_calls.append((owner, repo, task_id))
        if self.task_status_error:
            raise self.task_status_error
        assert self.task_status is not None
        return self.task_status

    def get_pr_from_graphql(self, global_id: str) -> GithubPullRequest | None:
        self.get_pr_from_graphql_calls.append(global_id)
        return self.pr_from_graphql

    def get_pr_from_branch(self, owner: str, repo: str, head_ref: str) -> GithubPullRequest | None:
        self.get_pr_from_branch_calls.append((owner, repo, head_ref))
        if self.pr_from_branch_error:
            raise self.pr_from_branch_error
        return self.pr_from_branch


def _patch_github_copilot_client(fake_client: FakeGithubCopilotAgentClient):
    return patch.multiple(
        GithubCopilotAgentClient,
        __init__=lambda self, *args, **kwargs: None,
        get_task_status=fake_client.get_task_status,
        get_pr_from_graphql=fake_client.get_pr_from_graphql,
        get_pr_from_branch=fake_client.get_pr_from_branch,
    )


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

    @patch(MOCK_SYNC_STATUS_PATH)
    @patch("sentry.seer.autofix.coding_agent.github_copilot_identity_service")
    def test_poll_updates_state_when_pr_created(self, mock_identity_service, mock_sync_status):
        """Test that polling updates agent state when a PR is found"""
        mock_identity_service.get_access_token_for_user.return_value = "test_token"

        fake_client = FakeGithubCopilotAgentClient(
            task_status=GithubCopilotTask(
                id="task-123",
                state="completed",
                html_url="https://github.com/getsentry/sentry/copilot/tasks/task-123",
                artifacts=[
                    GithubCopilotArtifact(
                        provider="github",
                        type="pull_request",
                        data=GithubCopilotArtifactData(id=456, type="pull", global_id="PR_abc123"),
                    )
                ],
            ),
            pr_from_graphql=GithubPullRequest(
                number=456,
                title="Fix the bug",
                url="https://github.com/getsentry/sentry/pull/12345",
            ),
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

        with _patch_github_copilot_client(fake_client):
            poll_github_copilot_agents(autofix_state, user_id=self.user.id)

        assert fake_client.get_task_status_calls == [("getsentry", "sentry", "task-123")]
        assert fake_client.get_pr_from_graphql_calls == ["PR_abc123"]
        mock_sync_status.assert_called_once()

        call_kwargs = mock_sync_status.call_args[1]
        assert call_kwargs["agent_id"] == "getsentry:sentry:task-123"
        assert call_kwargs["organization_id"] == self.organization.id
        assert call_kwargs["status"] == CodingAgentStatus.COMPLETED
        assert (
            call_kwargs["agent_url"] == "https://github.com/getsentry/sentry/copilot/tasks/task-123"
        )
        assert call_kwargs["result"].pr_url == "https://github.com/getsentry/sentry/pull/12345"
        assert call_kwargs["result"].description == "Fix the bug"
        assert call_kwargs["result"].repo_full_name == "getsentry/sentry"

    @patch(MOCK_SYNC_STATUS_PATH)
    @patch("sentry.seer.autofix.coding_agent.github_copilot_identity_service")
    def test_poll_falls_back_to_branch_when_global_id_empty(
        self, mock_identity_service, mock_sync_status
    ):
        """When the Copilot API returns an empty global_id, resolve the PR via the head branch."""
        mock_identity_service.get_access_token_for_user.return_value = "test_token"

        fake_client = FakeGithubCopilotAgentClient(
            task_status=GithubCopilotTask(
                id="task-123",
                state="completed",
                artifacts=[
                    GithubCopilotArtifact(
                        provider="github",
                        type="github_resource",
                        data=GithubCopilotArtifactData(id=456, type="pull", global_id=""),
                    ),
                    GithubCopilotArtifact(
                        provider="github",
                        type="branch",
                        data=GithubCopilotArtifactData(head_ref="copilot/fix-bug", base_ref="main"),
                    ),
                ],
            ),
            pr_from_branch=GithubPullRequest(
                number=46, title="Fix the bug", url="https://github.com/getsentry/sentry/pull/46"
            ),
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

        with _patch_github_copilot_client(fake_client):
            poll_github_copilot_agents(autofix_state, user_id=self.user.id)

        # Empty global_id -> GraphQL path skipped, branch fallback used.
        assert fake_client.get_pr_from_graphql_calls == []
        assert fake_client.get_pr_from_branch_calls == [("getsentry", "sentry", "copilot/fix-bug")]

        mock_sync_status.assert_called_once()
        call_kwargs = mock_sync_status.call_args[1]
        assert call_kwargs["status"] == CodingAgentStatus.COMPLETED
        assert call_kwargs["result"].pr_url == "https://github.com/getsentry/sentry/pull/46"
        assert call_kwargs["result"].description == "Fix the bug"

    @patch(MOCK_SYNC_STATUS_PATH)
    @patch("sentry.seer.autofix.coding_agent.github_copilot_identity_service")
    def test_poll_marks_completed_without_pr_when_unresolved(
        self, mock_identity_service, mock_sync_status
    ):
        """A completed task flips to COMPLETED even when no PR can be resolved."""
        mock_identity_service.get_access_token_for_user.return_value = "test_token"

        fake_client = FakeGithubCopilotAgentClient(
            task_status=GithubCopilotTask(
                id="task-123",
                state="completed",
                artifacts=[
                    GithubCopilotArtifact(
                        provider="github",
                        type="branch",
                        data=GithubCopilotArtifactData(head_ref="copilot/fix-bug", base_ref="main"),
                    ),
                ],
            ),
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

        with _patch_github_copilot_client(fake_client):
            poll_github_copilot_agents(autofix_state, user_id=self.user.id)

        assert fake_client.get_pr_from_branch_calls == [("getsentry", "sentry", "copilot/fix-bug")]
        mock_sync_status.assert_called_once()
        call_kwargs = mock_sync_status.call_args[1]
        assert call_kwargs["status"] == CodingAgentStatus.COMPLETED
        assert call_kwargs["result"] is None

    @patch("sentry.seer.autofix.coding_agent.attribute_delegated_agent_pull_request")
    @patch(MOCK_SYNC_STATUS_PATH)
    @patch("sentry.seer.autofix.coding_agent.github_copilot_identity_service")
    def test_poll_attributes_pr_when_task_complete(
        self, mock_identity_service, mock_sync_status, mock_attribute
    ):
        """A completed Copilot task with a PR is attributed to the Copilot agent, and both
        Seer's state and the Sentry-side SeerRunCodingAgentHandoff row are synced in one call."""
        mock_identity_service.get_access_token_for_user.return_value = "test_token"

        fake_client = FakeGithubCopilotAgentClient(
            task_status=GithubCopilotTask(
                id="task-123",
                state="completed",
                artifacts=[
                    GithubCopilotArtifact(
                        provider="github",
                        type="pull_request",
                        data=GithubCopilotArtifactData(id=456, type="pull", global_id="PR_abc123"),
                    )
                ],
            ),
            pr_from_graphql=GithubPullRequest(
                number=456,
                title="Fix the bug",
                url="https://github.com/getsentry/sentry/pull/12345",
            ),
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

        with _patch_github_copilot_client(fake_client):
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
            run_id=self.run_id,
        )

        call_kwargs = mock_sync_status.call_args.kwargs
        assert call_kwargs["agent_id"] == "getsentry:sentry:task-123"
        assert call_kwargs["organization_id"] == self.organization.id
        assert call_kwargs["status"] == CodingAgentStatus.COMPLETED
        assert call_kwargs["result"].pr_url == "https://github.com/getsentry/sentry/pull/12345"

    @patch("sentry.seer.autofix.coding_agent.attribute_delegated_agent_pull_request")
    @patch(MOCK_SYNC_STATUS_PATH)
    @patch("sentry.seer.autofix.coding_agent.github_copilot_identity_service")
    def test_poll_does_not_attribute_when_task_not_done(
        self, mock_identity_service, mock_sync_status, mock_attribute
    ):
        """A PR seen while the task is still running is not attributed yet."""
        mock_identity_service.get_access_token_for_user.return_value = "test_token"

        fake_client = FakeGithubCopilotAgentClient(
            task_status=GithubCopilotTask(
                id="task-123",
                state="in_progress",
                artifacts=[
                    GithubCopilotArtifact(
                        provider="github",
                        type="pull_request",
                        data=GithubCopilotArtifactData(id=456, type="pull", global_id="PR_abc123"),
                    )
                ],
            ),
            pr_from_graphql=GithubPullRequest(
                number=456, title="WIP", url="https://github.com/getsentry/sentry/pull/12345"
            ),
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

        with _patch_github_copilot_client(fake_client):
            poll_github_copilot_agents(
                autofix_state,
                user_id=self.user.id,
                organization_id=self.organization.id,
            )

        mock_attribute.assert_not_called()

    @patch(MOCK_SYNC_STATUS_PATH)
    @patch("sentry.seer.autofix.coding_agent.github_copilot_identity_service")
    def test_poll_marks_agent_failed_on_error_status(self, mock_identity_service, mock_sync_status):
        """Test that polling marks agent as failed when task status is error"""
        mock_identity_service.get_access_token_for_user.return_value = "test_token"

        fake_client = FakeGithubCopilotAgentClient(
            task_status=GithubCopilotTask(id="task-123", state="failed"),
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

        with _patch_github_copilot_client(fake_client):
            poll_github_copilot_agents(autofix_state, user_id=self.user.id)

        mock_sync_status.assert_called_once_with(
            agent_id="getsentry:sentry:task-123",
            organization_id=self.organization.id,
            status=CodingAgentStatus.FAILED,
            agent_url=None,
            result=None,
        )

    @patch(MOCK_SYNC_STATUS_PATH)
    @patch("sentry.seer.autofix.coding_agent.github_copilot_identity_service")
    def test_poll_marks_completed_when_pr_resolution_errors(
        self, mock_identity_service, mock_sync_status
    ):
        """A GitHub API error during PR resolution must not block the terminal status update."""
        mock_identity_service.get_access_token_for_user.return_value = "test_token"

        fake_client = FakeGithubCopilotAgentClient(
            task_status=GithubCopilotTask(
                id="task-123",
                state="completed",
                artifacts=[
                    GithubCopilotArtifact(
                        provider="github",
                        type="branch",
                        data=GithubCopilotArtifactData(head_ref="copilot/fix-bug", base_ref="main"),
                    ),
                ],
            ),
            pr_from_branch_error=Exception("GitHub 502"),
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

        with _patch_github_copilot_client(fake_client):
            poll_github_copilot_agents(autofix_state, user_id=self.user.id)

        assert fake_client.get_pr_from_branch_calls == [("getsentry", "sentry", "copilot/fix-bug")]
        mock_sync_status.assert_called_once()
        call_kwargs = mock_sync_status.call_args[1]
        assert call_kwargs["status"] == CodingAgentStatus.COMPLETED
        assert call_kwargs["result"] is None

    @patch(MOCK_SYNC_STATUS_PATH)
    @patch("sentry.seer.autofix.coding_agent.github_copilot_identity_service")
    def test_poll_marks_failed_even_when_branch_has_pr(
        self, mock_identity_service, mock_sync_status
    ):
        """A failed/timed_out task is marked FAILED even if a PR exists on the head branch."""
        mock_identity_service.get_access_token_for_user.return_value = "test_token"

        fake_client = FakeGithubCopilotAgentClient(
            task_status=GithubCopilotTask(
                id="task-123",
                state="failed",
                artifacts=[
                    GithubCopilotArtifact(
                        provider="github",
                        type="branch",
                        data=GithubCopilotArtifactData(head_ref="copilot/fix-bug", base_ref="main"),
                    ),
                ],
            ),
            # A draft PR may already exist on the head branch even though the task failed.
            pr_from_branch=GithubPullRequest(
                number=46, title="WIP", url="https://github.com/getsentry/sentry/pull/46"
            ),
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

        with _patch_github_copilot_client(fake_client):
            poll_github_copilot_agents(autofix_state, user_id=self.user.id)

        mock_sync_status.assert_called_once()
        call_kwargs = mock_sync_status.call_args[1]
        assert call_kwargs["status"] == CodingAgentStatus.FAILED

    @patch(MOCK_SYNC_STATUS_PATH)
    @patch("sentry.seer.autofix.coding_agent.github_copilot_identity_service")
    def test_poll_keeps_running_status_when_task_not_done(
        self, mock_identity_service, mock_sync_status
    ):
        """Test that polling keeps RUNNING status when task is still in progress"""
        mock_identity_service.get_access_token_for_user.return_value = "test_token"

        fake_client = FakeGithubCopilotAgentClient(
            task_status=GithubCopilotTask(
                id="task-123",
                state="in_progress",
                artifacts=[
                    GithubCopilotArtifact(
                        provider="github",
                        type="pull_request",
                        data=GithubCopilotArtifactData(id=456, type="pull", global_id="PR_abc123"),
                    )
                ],
            ),
            pr_from_graphql=GithubPullRequest(
                number=456,
                title="Fix the bug",
                url="https://github.com/getsentry/sentry/pull/12345",
            ),
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

        with _patch_github_copilot_client(fake_client):
            poll_github_copilot_agents(autofix_state, user_id=self.user.id)

        mock_sync_status.assert_called_once()
        call_kwargs = mock_sync_status.call_args[1]
        assert call_kwargs["status"] == CodingAgentStatus.RUNNING

    @patch(MOCK_SYNC_STATUS_PATH)
    @patch("sentry.seer.autofix.coding_agent.github_copilot_identity_service")
    def test_poll_handles_api_exception(self, mock_identity_service, mock_sync_status):
        """Test that polling handles exceptions gracefully"""
        mock_identity_service.get_access_token_for_user.return_value = "test_token"

        fake_client = FakeGithubCopilotAgentClient(task_status_error=Exception("API Error"))

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

        with _patch_github_copilot_client(fake_client):
            # Should not raise - exception should be caught and logged
            poll_github_copilot_agents(autofix_state, user_id=self.user.id)

        # State should not be updated when there's an error
        mock_sync_status.assert_not_called()

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


MOCK_CLIENT_CLASS_PATH = "sentry.integrations.claude_code.integration._get_client_class"
MOCK_INTEGRATION_SERVICE_PATH = "sentry.seer.autofix.coding_agent.integration_service"


def _make_agent_event(text: str) -> ClaudeSessionEvent:
    return ClaudeSessionEvent(type="agent.message", content=[{"type": "text", "text": text}])


class FakeClaudeCodeClient:
    def __init__(
        self,
        events: list[dict] | None = None,
        result: CodingAgentResult | None = None,
    ) -> None:
        self.events = events or []
        self.result = result
        self.list_session_events_calls: list[str] = []
        self.build_result_from_session_calls: list[dict[str, str | None]] = []

    def list_session_events(self, agent_id: str) -> list[dict]:
        self.list_session_events_calls.append(agent_id)
        return self.events

    def build_result_from_session(
        self, *, agent_name: str, pr_url: str | None
    ) -> CodingAgentResult | None:
        self.build_result_from_session_calls.append({"agent_name": agent_name, "pr_url": pr_url})
        return self.result


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

    @patch(MOCK_SYNC_STATUS_PATH)
    @patch(MOCK_CLIENT_CLASS_PATH)
    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_polls_running_agent_and_updates_completed(
        self, mock_integration_service, mock_import_string, mock_sync_status
    ):
        self._mock_integration(mock_integration_service)
        fake_client = FakeClaudeCodeClient(
            events=[
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
            ],
            result=CodingAgentResult(
                description="",
                repo_provider="github",
                repo_full_name="getsentry/sentry",
                pr_url="https://github.com/getsentry/sentry/pull/999",
            ),
        )
        mock_import_string.return_value = lambda **kwargs: fake_client

        agents = {"claude-session-123": self._create_claude_agent()}
        autofix_state = self._create_autofix_state_with_agents(agents)
        poll_claude_code_agents(autofix_state=autofix_state)

        assert fake_client.list_session_events_calls == ["claude-session-123"]
        mock_sync_status.assert_called_once()
        call_kwargs = mock_sync_status.call_args[1]
        assert call_kwargs["agent_id"] == "claude-session-123"
        assert call_kwargs["organization_id"] == self.organization.id
        assert call_kwargs["status"] == CodingAgentStatus.COMPLETED

    @patch("sentry.seer.autofix.coding_agent.attribute_delegated_agent_pull_request")
    @patch(MOCK_SYNC_STATUS_PATH)
    @patch(MOCK_CLIENT_CLASS_PATH)
    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_attributes_pr_on_completion(
        self, mock_integration_service, mock_import_string, mock_sync_status, mock_attribute
    ):
        """A completed Claude session with a PR is attributed to the Claude agent, and both
        Seer's state and the Sentry-side SeerRunCodingAgentHandoff row are synced in one call."""
        self._mock_integration(mock_integration_service)
        fake_client = FakeClaudeCodeClient(
            events=[
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
            ],
            result=CodingAgentResult(
                description="",
                repo_provider="github",
                repo_full_name="getsentry/sentry",
                pr_url="https://github.com/getsentry/sentry/pull/999",
            ),
        )
        mock_import_string.return_value = lambda **kwargs: fake_client

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
            run_id=self.run_id,
        )

        call_kwargs = mock_sync_status.call_args.kwargs
        assert call_kwargs["agent_id"] == "claude-session-123"
        assert call_kwargs["organization_id"] == self.organization.id
        assert call_kwargs["status"] == CodingAgentStatus.COMPLETED
        assert call_kwargs["result"].pr_url == "https://github.com/getsentry/sentry/pull/999"

    @patch("sentry.seer.autofix.coding_agent.attribute_delegated_agent_pull_request")
    @patch(MOCK_SYNC_STATUS_PATH)
    @patch(MOCK_CLIENT_CLASS_PATH)
    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_does_not_attribute_when_no_pr_url(
        self, mock_integration_service, mock_import_string, mock_sync_status, mock_attribute
    ):
        """A completed session without a PR is not attributed."""
        self._mock_integration(mock_integration_service)
        fake_client = FakeClaudeCodeClient(
            events=[
                {"type": "agent.message", "content": [{"type": "text", "text": "Done, no PR."}]},
                {"type": ClaudeSessionEventStatus.IDLE},
            ],
            result=CodingAgentResult(
                description="", repo_provider="github", repo_full_name="getsentry/sentry"
            ),
        )
        mock_import_string.return_value = lambda **kwargs: fake_client

        agents = {"claude-session-123": self._create_claude_agent()}
        autofix_state = self._create_autofix_state_with_agents(agents)
        poll_claude_code_agents(autofix_state=autofix_state)

        mock_attribute.assert_not_called()

    @patch(MOCK_SYNC_STATUS_PATH)
    @patch(MOCK_CLIENT_CLASS_PATH)
    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_marks_failed_when_no_pr_url(
        self, mock_integration_service, mock_import_string, mock_sync_status
    ):
        self._mock_integration(mock_integration_service)
        fake_client = FakeClaudeCodeClient(
            events=[
                {"type": "agent.message", "content": [{"type": "text", "text": "Done, no PR."}]},
                {"type": ClaudeSessionEventStatus.IDLE},
            ],
            result=CodingAgentResult(
                description="", repo_provider="github", repo_full_name="getsentry/sentry"
            ),
        )
        mock_import_string.return_value = lambda **kwargs: fake_client

        agents = {"claude-session-123": self._create_claude_agent()}
        autofix_state = self._create_autofix_state_with_agents(agents)
        poll_claude_code_agents(autofix_state=autofix_state)

        mock_sync_status.assert_called_once()
        call_kwargs = mock_sync_status.call_args[1]
        assert call_kwargs["status"] == CodingAgentStatus.FAILED

    @patch(MOCK_SYNC_STATUS_PATH)
    @patch(MOCK_CLIENT_CLASS_PATH)
    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_no_update_when_status_unchanged(
        self, mock_integration_service, mock_import_string, mock_sync_status
    ):
        self._mock_integration(mock_integration_service)
        # Last event is session.status_running — agent is already RUNNING, no update needed
        fake_client = FakeClaudeCodeClient(events=[{"type": ClaudeSessionEventStatus.RUNNING}])
        mock_import_string.return_value = lambda **kwargs: fake_client

        agents = {"claude-session-123": self._create_claude_agent()}
        autofix_state = self._create_autofix_state_with_agents(agents)
        poll_claude_code_agents(autofix_state=autofix_state)

        mock_sync_status.assert_not_called()

    @patch(MOCK_SYNC_STATUS_PATH)
    @patch(MOCK_CLIENT_CLASS_PATH)
    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_no_update_when_events_empty(
        self, mock_integration_service, mock_import_string, mock_sync_status
    ):
        self._mock_integration(mock_integration_service)
        fake_client = FakeClaudeCodeClient(events=[])
        mock_import_string.return_value = lambda **kwargs: fake_client

        agents = {"claude-session-123": self._create_claude_agent()}
        autofix_state = self._create_autofix_state_with_agents(agents)
        poll_claude_code_agents(autofix_state=autofix_state)

        mock_sync_status.assert_not_called()

    @patch(MOCK_SYNC_STATUS_PATH)
    @patch(MOCK_CLIENT_CLASS_PATH)
    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_updates_pending_to_running_on_non_idle_event(
        self, mock_integration_service, mock_import_string, mock_sync_status
    ):
        self._mock_integration(mock_integration_service)
        fake_client = FakeClaudeCodeClient(events=[{"type": "agent.message", "content": []}])
        mock_import_string.return_value = lambda **kwargs: fake_client

        agents = {"claude-session-123": self._create_claude_agent(status=CodingAgentStatus.PENDING)}
        autofix_state = self._create_autofix_state_with_agents(agents)
        poll_claude_code_agents(autofix_state=autofix_state)

        # A single call keeps Seer's state and the Sentry-side handoff row in lockstep.
        mock_sync_status.assert_called_once_with(
            agent_id="claude-session-123",
            organization_id=self.organization.id,
            status=CodingAgentStatus.RUNNING,
        )

    @patch(MOCK_SYNC_STATUS_PATH)
    @patch(MOCK_CLIENT_CLASS_PATH)
    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_stays_pending_on_status_rescheduling_event(
        self, mock_integration_service, mock_import_string, mock_sync_status
    ):
        self._mock_integration(mock_integration_service)
        fake_client = FakeClaudeCodeClient(events=[{"type": ClaudeSessionEventStatus.RESCHEDULING}])
        mock_import_string.return_value = lambda **kwargs: fake_client

        agents = {"claude-session-123": self._create_claude_agent(status=CodingAgentStatus.PENDING)}
        autofix_state = self._create_autofix_state_with_agents(agents)
        poll_claude_code_agents(autofix_state=autofix_state)

        mock_sync_status.assert_not_called()

    @patch(MOCK_SYNC_STATUS_PATH)
    @patch(MOCK_CLIENT_CLASS_PATH)
    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_updates_running_to_pending_on_rescheduling_event(
        self, mock_integration_service, mock_import_string, mock_sync_status
    ):
        """A RESCHEDULING event on a RUNNING session must sync both Seer's state and the
        Sentry-side handoff row back to pending, in one call."""
        self._mock_integration(mock_integration_service)
        fake_client = FakeClaudeCodeClient(events=[{"type": ClaudeSessionEventStatus.RESCHEDULING}])
        mock_import_string.return_value = lambda **kwargs: fake_client

        agents = {"claude-session-123": self._create_claude_agent(status=CodingAgentStatus.RUNNING)}
        autofix_state = self._create_autofix_state_with_agents(agents)
        poll_claude_code_agents(autofix_state=autofix_state)

        mock_sync_status.assert_called_once_with(
            agent_id="claude-session-123",
            organization_id=self.organization.id,
            status=CodingAgentStatus.PENDING,
        )

    @patch(MOCK_SYNC_STATUS_PATH)
    @patch(MOCK_CLIENT_CLASS_PATH)
    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_uses_correct_integration_per_agent(
        self, mock_integration_service, mock_get_client_class, mock_sync_status
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
        mock_integration_service.get_integration.side_effect = lambda integration_id: {
            100: integration_a,
            200: integration_b,
        }[integration_id]

        clients: dict[str, FakeClaudeCodeClient] = {}

        def make_client(**kwargs):
            client = FakeClaudeCodeClient(events=[{"type": ClaudeSessionEventStatus.RUNNING}])
            clients[kwargs["api_key"]] = client
            return client

        mock_get_client_class.return_value = make_client

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
        assert clients["sk-ant-aaa"].list_session_events_calls == ["session-a"]
        assert clients["sk-ant-bbb"].list_session_events_calls == ["session-b"]

    @patch(MOCK_SYNC_STATUS_PATH)
    @patch(MOCK_CLIENT_CLASS_PATH)
    @patch(MOCK_INTEGRATION_SERVICE_PATH)
    def test_caches_client_for_same_integration(
        self, mock_integration_service, mock_import_string, mock_sync_status
    ):
        self._mock_integration(mock_integration_service)
        fake_client = FakeClaudeCodeClient(events=[{"type": ClaudeSessionEventStatus.RUNNING}])
        mock_import_string.return_value = lambda **kwargs: fake_client

        agent_a = self._create_claude_agent(agent_id="session-a")
        agent_b = self._create_claude_agent(agent_id="session-b")
        autofix_state = self._create_autofix_state_with_agents(
            {"session-a": agent_a, "session-b": agent_b}
        )
        poll_claude_code_agents(autofix_state=autofix_state)

        mock_integration_service.get_integration.assert_called_once()
        assert len(fake_client.list_session_events_calls) == 2
