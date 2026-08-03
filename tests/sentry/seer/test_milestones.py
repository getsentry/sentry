from sentry.seer.agent.client_models import (
    AgentFilePatch,
    CodingAgentResult,
    CodingAgentState,
    FilePatch,
    MemoryBlock,
    Message,
    SeerRunState,
)
from sentry.seer.milestones import (
    SEER_STATE_MILESTONES,
    milestones_from_state,
    reconcile_milestones,
)
from sentry.seer.models.run import SeerRunMilestone, SeerRunMilestoneType
from sentry.testutils.cases import TestCase


def _state(blocks=None, coding_agents=None) -> SeerRunState:
    return SeerRunState(
        run_id=1,
        blocks=blocks or [],
        status="completed",
        updated_at="2026-02-10T00:00:00Z",
        coding_agents=coding_agents or {},
    )


def _coding_agent(pr_number: int | None, pr_url: str | None) -> CodingAgentState:
    return CodingAgentState(
        id="agent-1",
        status="completed",
        provider="cursor_background_agent",
        name="Cursor",
        started_at="2026-02-10T00:00:00Z",
        results=[
            CodingAgentResult(
                description="d",
                repo_provider="github",
                repo_full_name="owner/repo",
                pr_number=pr_number,
                pr_url=pr_url,
            )
        ],
    )


class MilestonesFromStateTest(TestCase):
    def test_native_pr_from_block_commit_shas(self) -> None:
        block = MemoryBlock(
            id="b",
            message=Message(role="assistant", content="c", metadata={"step": "code_changes"}),
            timestamp="2026-02-10T00:00:00Z",
            merged_file_patches=[
                AgentFilePatch(
                    repo_name="owner/repo",
                    patch=FilePatch(path="a.py", type="M", added=1, removed=0),
                )
            ],
            pr_commit_shas={"owner/repo": "abc"},
        )
        milestones = milestones_from_state(_state(blocks=[block]))
        assert SeerRunMilestoneType.HAS_PULL_REQUEST in milestones

    def test_coding_agent_pr_from_pr_number(self) -> None:
        state = _state(coding_agents={"agent-1": _coding_agent(pr_number=7, pr_url="url")})
        assert SeerRunMilestoneType.HAS_PULL_REQUEST in milestones_from_state(state)

    def test_coding_agent_branch_without_pr_number_is_not_a_pr(self) -> None:
        # pr_url can point at a pushed branch when the agent did not open a PR;
        # only pr_number confirms an actual PR.
        state = _state(coding_agents={"agent-1": _coding_agent(pr_number=None, pr_url="branch")})
        assert SeerRunMilestoneType.HAS_PULL_REQUEST not in milestones_from_state(state)


class ReconcileMilestonesTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.seer_run = self.create_seer_run(organization=self.organization)

    def _recorded(self) -> set[str]:
        return set(
            SeerRunMilestone.objects.filter(seer_run=self.seer_run).values_list(
                "milestone", flat=True
            )
        )

    def test_reconciles_managed_set_to_desired(self) -> None:
        reconcile_milestones(self.seer_run, desired=SEER_STATE_MILESTONES)
        assert self._recorded() == set(SEER_STATE_MILESTONES)
        # A re-run shrinks the derived set; no-longer-desired managed rows go.
        reconcile_milestones(self.seer_run, desired={SeerRunMilestoneType.ROOT_CAUSE})
        assert self._recorded() == {SeerRunMilestoneType.ROOT_CAUSE}
        # Empty desired clears the rest.
        reconcile_milestones(self.seer_run, desired=set())
        assert self._recorded() == set()

    def test_leaves_unmanaged_milestones_untouched(self) -> None:
        SeerRunMilestone.objects.create(
            seer_run=self.seer_run, milestone=SeerRunMilestoneType.PULL_REQUESTS_MERGED
        )
        reconcile_milestones(self.seer_run, desired={SeerRunMilestoneType.ROOT_CAUSE})
        # pull_requests_merged is outside SEER_STATE_MILESTONES, so reconcile must
        # not delete it even though it is absent from `desired`.
        assert self._recorded() == {
            SeerRunMilestoneType.ROOT_CAUSE,
            SeerRunMilestoneType.PULL_REQUESTS_MERGED,
        }
