from datetime import UTC, datetime
from unittest.mock import Mock, patch

from sentry.models.pullrequest import PullRequest
from sentry.seer.autofix.coding_agent_handoffs import (
    create_seer_run_coding_agent_handoffs,
    update_seer_run_coding_agent_handoff,
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


class CreateSeerRunCodingAgentHandoffsTest(TestCase):
    def setUp(self) -> None:
        self.seer_run = self.create_seer_run(
            self.organization, type=SeerRunType.FEATURE_RUN, seer_run_state_id=RUN_STATE_ID
        )

    def test_creates_one_row_per_state(self) -> None:
        states = [
            _state(agent_id="agent-1"),
            _state(agent_id="agent-2", provider=CodingAgentProviderType.CLAUDE_CODE_AGENT),
        ]

        create_seer_run_coding_agent_handoffs(self.organization, RUN_STATE_ID, states)

        handoffs = SeerRunCodingAgentHandoff.objects.filter(seer_run=self.seer_run).order_by(
            "agent_id"
        )
        assert [h.agent_id for h in handoffs] == ["agent-1", "agent-2"]
        assert handoffs[0].provider == "github_copilot_agent"
        assert handoffs[0].status == "running"
        assert handoffs[1].provider == "claude_code_agent"

    def test_noop_when_states_empty(self) -> None:
        create_seer_run_coding_agent_handoffs(self.organization, RUN_STATE_ID, [])

        assert not SeerRunCodingAgentHandoff.objects.exists()

    @patch("sentry.seer.autofix.coding_agent_handoffs.logger")
    def test_noop_when_run_not_found(self, mock_logger: Mock) -> None:
        create_seer_run_coding_agent_handoffs(self.organization, 999, [_state()])

        assert not SeerRunCodingAgentHandoff.objects.exists()
        mock_logger.info.assert_called_once_with(
            "seer.coding_agent_handoff.run_not_found",
            extra={"organization_id": self.organization.id, "run_id": 999},
        )


class UpdateSeerRunCodingAgentHandoffTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(self.project, name=REPO_NAME, provider="integrations:github")
        self.seer_run = self.create_seer_run(
            self.organization, type=SeerRunType.FEATURE_RUN, seer_run_state_id=RUN_STATE_ID
        )
        self.handoff = self.create_seer_run_coding_agent_handoff(
            self.seer_run, agent_id="agent-1", provider="github_copilot_agent"
        )

    def test_updates_status_and_agent_url(self) -> None:
        update_seer_run_coding_agent_handoff(
            agent_id="agent-1",
            organization_id=self.organization.id,
            status=CodingAgentStatus.COMPLETED,
            agent_url="https://github.com/copilot/agents/agent-1",
        )

        self.handoff.refresh_from_db()
        assert self.handoff.status == "completed"
        assert self.handoff.agent_url == "https://github.com/copilot/agents/agent-1"

    def test_links_pull_request_on_completion(self) -> None:
        result = CodingAgentResult(
            description="Fixed the bug",
            repo_provider="github",
            repo_full_name=REPO_NAME,
            pr_url="https://github.com/getsentry/sentry/pull/42",
        )

        update_seer_run_coding_agent_handoff(
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

    def test_does_not_link_pull_request_without_pr_url(self) -> None:
        result = CodingAgentResult(
            description="No PR yet", repo_provider="github", repo_full_name=REPO_NAME
        )

        update_seer_run_coding_agent_handoff(
            agent_id="agent-1",
            organization_id=self.organization.id,
            status=CodingAgentStatus.RUNNING,
            result=result,
        )

        self.handoff.refresh_from_db()
        assert self.handoff.pull_request_id is None
        assert not SeerRunPullRequest.objects.exists()

    @patch("sentry.seer.autofix.coding_agent_handoffs.logger")
    def test_noop_when_agent_id_not_found(self, mock_logger: Mock) -> None:
        update_seer_run_coding_agent_handoff(
            agent_id="does-not-exist",
            organization_id=self.organization.id,
            status=CodingAgentStatus.COMPLETED,
        )

        mock_logger.info.assert_called_once_with(
            "seer.coding_agent_handoff.not_found",
            extra={"agent_id": "does-not-exist", "organization_id": self.organization.id},
        )

    @patch("sentry.seer.autofix.coding_agent_handoffs.logger")
    def test_rejects_cross_org_agent_id(self, mock_logger: Mock) -> None:
        other_org = self.create_organization()

        update_seer_run_coding_agent_handoff(
            agent_id="agent-1",
            organization_id=other_org.id,
            status=CodingAgentStatus.COMPLETED,
        )

        self.handoff.refresh_from_db()
        assert self.handoff.status == "pending"
        mock_logger.warning.assert_called_once_with(
            "seer.coding_agent_handoff.org_mismatch",
            extra={"agent_id": "agent-1", "organization_id": other_org.id},
        )
