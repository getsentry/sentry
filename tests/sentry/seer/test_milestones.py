from sentry.seer.agent.client_models import (
    AgentFilePatch,
    Artifact,
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
    record_has_pull_request,
)
from sentry.seer.models.run import SeerRunMilestone, SeerRunMilestoneType
from sentry.testutils.cases import TestCase


def _state(
    blocks: list[MemoryBlock] | None = None,
    coding_agents: dict[str, CodingAgentState] | None = None,
) -> SeerRunState:
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


def _block(
    *,
    artifact_keys: tuple[str, ...] = (),
    with_diff: bool = False,
    pr_commit_shas: dict[str, str] | None = None,
) -> MemoryBlock:
    return MemoryBlock(
        id="b",
        message=Message(role="assistant", content="c"),
        timestamp="2026-02-10T00:00:00Z",
        artifacts=[Artifact(key=k, data={}, reason="r") for k in artifact_keys],
        merged_file_patches=(
            [
                AgentFilePatch(
                    repo_name="owner/repo",
                    patch=FilePatch(path="a.py", type="M", added=1, removed=0),
                )
            ]
            if with_diff
            else None
        ),
        pr_commit_shas=pr_commit_shas,
    )


def _state_reaching(milestones: set[str]) -> SeerRunState:
    keys = tuple(
        k
        for m, k in (
            (SeerRunMilestoneType.ROOT_CAUSE, "root_cause"),
            (SeerRunMilestoneType.SOLUTION, "solution"),
        )
        if m in milestones
    )
    return _state(
        blocks=[
            _block(
                artifact_keys=keys,
                with_diff=SeerRunMilestoneType.CODE_CHANGES in milestones,
                pr_commit_shas=(
                    {"owner/repo": "abc"}
                    if SeerRunMilestoneType.HAS_PULL_REQUEST in milestones
                    else None
                ),
            )
        ]
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

    def test_reconciles_managed_set_to_state(self) -> None:
        reconcile_milestones(self.seer_run, _state_reaching(set(SEER_STATE_MILESTONES)))
        assert self._recorded() == set(SEER_STATE_MILESTONES)
        # A re-run shrinks the derived set; no-longer-reached managed rows go.
        reconcile_milestones(self.seer_run, _state_reaching({SeerRunMilestoneType.ROOT_CAUSE}))
        assert self._recorded() == {SeerRunMilestoneType.ROOT_CAUSE}
        # A state that reached nothing clears the rest.
        reconcile_milestones(self.seer_run, _state_reaching(set()))
        assert self._recorded() == set()

    def test_leaves_unmanaged_milestones_untouched(self) -> None:
        SeerRunMilestone.objects.create(
            seer_run=self.seer_run, milestone=SeerRunMilestoneType.PULL_REQUESTS_MERGED
        )
        reconcile_milestones(self.seer_run, _state_reaching({SeerRunMilestoneType.ROOT_CAUSE}))
        # pull_requests_merged is outside SEER_STATE_MILESTONES, so reconcile must
        # not delete it even though the state did not reach it.
        assert self._recorded() == {
            SeerRunMilestoneType.ROOT_CAUSE,
            SeerRunMilestoneType.PULL_REQUESTS_MERGED,
        }


class RecordHasPullRequestTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.seer_run = self.create_seer_run(organization=self.organization)

    def _recorded(self) -> set[str]:
        return set(
            SeerRunMilestone.objects.filter(seer_run=self.seer_run).values_list(
                "milestone", flat=True
            )
        )

    def test_records_has_pull_request(self) -> None:
        record_has_pull_request(self.seer_run)
        assert self._recorded() == {SeerRunMilestoneType.HAS_PULL_REQUEST}

    def test_is_idempotent(self) -> None:
        record_has_pull_request(self.seer_run)
        record_has_pull_request(self.seer_run)
        assert self._recorded() == {SeerRunMilestoneType.HAS_PULL_REQUEST}

    def test_preserves_other_milestones(self) -> None:
        reconcile_milestones(self.seer_run, _state_reaching({SeerRunMilestoneType.ROOT_CAUSE}))
        record_has_pull_request(self.seer_run)
        assert self._recorded() == {
            SeerRunMilestoneType.ROOT_CAUSE,
            SeerRunMilestoneType.HAS_PULL_REQUEST,
        }
