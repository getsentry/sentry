from datetime import UTC, datetime
from unittest.mock import Mock, patch

from sentry.models.pullrequest import PullRequest
from sentry.seer.autofix.coding_agent_handoffs import (
    create_seer_run_coding_agent_handoff,
    sync_coding_agent_status,
)
from sentry.seer.autofix.utils import (
    CodingAgentProviderType,
    CodingAgentResult,
    CodingAgentState,
    CodingAgentStatus,
)
from sentry.seer.models.run import SeerRunCodingAgentHandoff, SeerRunPullRequest, SeerRunType
from sentry.testutils.cases import TestCase

REPO_NAME = "getsentry/sentry"
RUN_STATE_ID = 123
MOCK_UPDATE_STATE_PATH = "sentry.seer.autofix.coding_agent_handoffs.update_coding_agent_state"


def _state(
    agent_id: str = "agent-1",
    provider: CodingAgentProviderType = CodingAgentProviderType.GITHUB_COPILOT_AGENT,
    status: CodingAgentStatus = CodingAgentStatus.RUNNING,
    agent_url: str | None = None,
) -> CodingAgentState:
    return CodingAgentState(
        id=agent_id,
        status=status,
        agent_url=agent_url,
        provider=provider,
        name="Test Agent",
        started_at=datetime.now(UTC),
    )


class CreateSeerRunCodingAgentHandoffTest(TestCase):
    def setUp(self) -> None:
        self.seer_run = self.create_seer_run(
            self.organization, type=SeerRunType.FEATURE_RUN, seer_run_state_id=RUN_STATE_ID
        )

    def test_creates_row_for_state(self) -> None:
        create_seer_run_coding_agent_handoff(self.organization, RUN_STATE_ID, _state())

        handoff = SeerRunCodingAgentHandoff.objects.get(seer_run=self.seer_run)
        assert handoff.agent_id == "agent-1"
        assert handoff.provider == "github_copilot_agent"
        assert handoff.status == "running"

    def test_called_once_per_launched_state(self) -> None:
        create_seer_run_coding_agent_handoff(self.organization, RUN_STATE_ID, _state("agent-1"))
        create_seer_run_coding_agent_handoff(
            self.organization,
            RUN_STATE_ID,
            _state("agent-2", provider=CodingAgentProviderType.CLAUDE_CODE_AGENT),
        )

        handoffs = SeerRunCodingAgentHandoff.objects.filter(seer_run=self.seer_run).order_by(
            "agent_id"
        )
        assert [h.agent_id for h in handoffs] == ["agent-1", "agent-2"]
        assert handoffs[1].provider == "claude_code_agent"

    @patch("sentry.seer.autofix.coding_agent_handoffs.logger")
    def test_noop_when_run_not_found(self, mock_logger: Mock) -> None:
        create_seer_run_coding_agent_handoff(self.organization, 999, _state())

        assert not SeerRunCodingAgentHandoff.objects.exists()
        mock_logger.info.assert_called_once_with(
            "seer.coding_agent_handoff.run_not_found",
            extra={"organization_id": self.organization.id, "run_id": 999},
        )


class SyncCodingAgentStatusTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(self.project, name=REPO_NAME, provider="integrations:github")
        self.seer_run = self.create_seer_run(
            self.organization, type=SeerRunType.FEATURE_RUN, seer_run_state_id=RUN_STATE_ID
        )
        self.handoff = self.create_seer_run_coding_agent_handoff(
            self.seer_run, agent_id="agent-1", provider="github_copilot_agent"
        )

    @patch(MOCK_UPDATE_STATE_PATH)
    def test_updates_seer_and_returns_known_to_seer(self, mock_update_state: Mock) -> None:
        mock_update_state.return_value = True

        known_to_seer = sync_coding_agent_status(
            agent_id="agent-1",
            organization_id=self.organization.id,
            status=CodingAgentStatus.COMPLETED,
            agent_url="https://github.com/copilot/agents/agent-1",
        )

        mock_update_state.assert_called_once_with(
            agent_id="agent-1",
            status=CodingAgentStatus.COMPLETED,
            agent_url="https://github.com/copilot/agents/agent-1",
            result=None,
        )
        assert known_to_seer is True

        self.handoff.refresh_from_db()
        assert self.handoff.status == "completed"
        assert self.handoff.extras["agent_url"] == "https://github.com/copilot/agents/agent-1"

    @patch(MOCK_UPDATE_STATE_PATH)
    def test_returns_false_when_seer_does_not_recognize_agent(
        self, mock_update_state: Mock
    ) -> None:
        mock_update_state.return_value = False

        known_to_seer = sync_coding_agent_status(
            agent_id="agent-1",
            organization_id=self.organization.id,
            status=CodingAgentStatus.COMPLETED,
        )

        assert known_to_seer is False
        # The Sentry-side row still updates even if Seer didn't recognize the agent --
        # the two systems are independent, so the return value is informational only.
        self.handoff.refresh_from_db()
        assert self.handoff.status == "completed"

    @patch(MOCK_UPDATE_STATE_PATH)
    def test_links_pull_request_on_completion(self, mock_update_state: Mock) -> None:
        mock_update_state.return_value = True
        result = CodingAgentResult(
            description="Fixed the bug",
            repo_provider="github",
            repo_full_name=REPO_NAME,
            pr_url="https://github.com/getsentry/sentry/pull/42",
        )

        sync_coding_agent_status(
            agent_id="agent-1",
            organization_id=self.organization.id,
            status=CodingAgentStatus.COMPLETED,
            result=result,
        )

        pull_request = PullRequest.objects.get(repository_id=self.repo.id, key="42")
        self.handoff.refresh_from_db()
        assert self.handoff.pull_request_id == pull_request.id

        link = SeerRunPullRequest.objects.get(pull_request=pull_request)
        assert link.seer_run_id == self.seer_run.id

    @patch("sentry.seer.pull_requests.options.get", return_value=True)
    @patch(MOCK_UPDATE_STATE_PATH)
    def test_killswitch_disables_pull_request_linking(
        self, mock_update_state: Mock, mock_option: Mock
    ) -> None:
        """The seer.pull-request-linking killswitch must also gate the handoff path,
        not just Seer's own seer.pr_created path -- both write the same SeerRunPullRequest
        rows, so the switch must not be bypassable from either one."""
        mock_update_state.return_value = True
        result = CodingAgentResult(
            description="Fixed the bug",
            repo_provider="github",
            repo_full_name=REPO_NAME,
            pr_url="https://github.com/getsentry/sentry/pull/42",
        )

        sync_coding_agent_status(
            agent_id="agent-1",
            organization_id=self.organization.id,
            status=CodingAgentStatus.COMPLETED,
            result=result,
        )

        mock_option.assert_called_once_with("seer.pull-request-linking.killswitch.enabled")
        assert not SeerRunPullRequest.objects.exists()
        assert not PullRequest.objects.filter(repository_id=self.repo.id, key="42").exists()

        # The handoff's own status must still update -- only PR linking is gated.
        self.handoff.refresh_from_db()
        assert self.handoff.status == "completed"
        assert self.handoff.pull_request_id is None

    @patch(MOCK_UPDATE_STATE_PATH)
    def test_does_not_link_pull_request_without_pr_url(self, mock_update_state: Mock) -> None:
        mock_update_state.return_value = True
        result = CodingAgentResult(
            description="No PR yet", repo_provider="github", repo_full_name=REPO_NAME
        )

        sync_coding_agent_status(
            agent_id="agent-1",
            organization_id=self.organization.id,
            status=CodingAgentStatus.RUNNING,
            result=result,
        )

        self.handoff.refresh_from_db()
        assert self.handoff.pull_request_id is None
        assert not SeerRunPullRequest.objects.exists()

    @patch(MOCK_UPDATE_STATE_PATH)
    def test_skips_seer_call_when_local_save_fails(self, mock_update_state: Mock) -> None:
        """If the local write fails, don't tell Seer either -- otherwise Seer would
        move to a terminal status while our row stays stale, and poll-based
        providers only retry while Seer still shows the agent as running/pending."""
        with patch.object(SeerRunCodingAgentHandoff, "save", side_effect=Exception("db blip")):
            known_to_seer = sync_coding_agent_status(
                agent_id="agent-1",
                organization_id=self.organization.id,
                status=CodingAgentStatus.COMPLETED,
            )

        assert known_to_seer is False
        mock_update_state.assert_not_called()
        self.handoff.refresh_from_db()
        assert self.handoff.status == "pending"

    @patch("sentry.seer.autofix.coding_agent_handoffs.logger")
    @patch(MOCK_UPDATE_STATE_PATH)
    def test_noop_when_agent_id_not_found(self, mock_update_state: Mock, mock_logger: Mock) -> None:
        mock_update_state.return_value = True

        known_to_seer = sync_coding_agent_status(
            agent_id="does-not-exist",
            organization_id=self.organization.id,
            status=CodingAgentStatus.COMPLETED,
        )

        assert known_to_seer is True
        mock_logger.info.assert_called_once_with(
            "seer.coding_agent_handoff.not_found",
            extra={"agent_id": "does-not-exist", "organization_id": self.organization.id},
        )

    @patch("sentry.seer.autofix.coding_agent_handoffs.logger")
    @patch(MOCK_UPDATE_STATE_PATH)
    def test_rejects_cross_org_agent_id(self, mock_update_state: Mock, mock_logger: Mock) -> None:
        mock_update_state.return_value = True
        other_org = self.create_organization()

        sync_coding_agent_status(
            agent_id="agent-1",
            organization_id=other_org.id,
            status=CodingAgentStatus.COMPLETED,
        )

        self.handoff.refresh_from_db()
        assert self.handoff.status == "pending"
        mock_logger.info.assert_called_once_with(
            "seer.coding_agent_handoff.not_found",
            extra={"agent_id": "agent-1", "organization_id": other_org.id},
        )
