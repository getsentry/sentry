from datetime import UTC, datetime
from unittest import mock

from sentry.models.pullrequest import PullRequestLifecycleState
from sentry.seer.agent.client_models import (
    AgentFilePatch,
    Artifact,
    CodingAgentResult,
    CodingAgentState,
    DiffLine,
    FilePatch,
    Hunk,
    MemoryBlock,
    Message,
    RepoPRState,
    SeerRunState,
)
from sentry.seer.milestones import (
    SEER_STATE_MILESTONES,
    milestones_from_state,
    reconcile_milestones,
    reconcile_pull_requests_merged_milestone,
    record_has_pull_request,
)
from sentry.seer.models.run import SeerRunMilestone, SeerRunMilestoneType
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time


def _state(
    blocks: list[MemoryBlock] | None = None,
    coding_agents: dict[str, CodingAgentState] | None = None,
    repo_pr_states: dict[str, RepoPRState] | None = None,
) -> SeerRunState:
    return SeerRunState(
        run_id=1,
        blocks=blocks or [],
        status="completed",
        updated_at="2026-02-10T00:00:00Z",
        coding_agents=coding_agents or {},
        repo_pr_states=repo_pr_states or {},
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


def _agent_file_patch(path: str = "a.py", value: str = "+added line") -> AgentFilePatch:
    return AgentFilePatch(
        repo_name="getsentry/sentry",
        patch=FilePatch(
            path=path,
            type="M",
            added=1,
            removed=0,
            source_file=path,
            target_file=path,
            hunks=[
                Hunk(
                    source_start=1,
                    source_length=1,
                    target_start=1,
                    target_length=2,
                    section_header="@@ -1,1 +1,2 @@",
                    lines=[
                        DiffLine(
                            diff_line_no=1,
                            source_line_no=None,
                            target_line_no=2,
                            line_type="+",
                            value=value,
                        )
                    ],
                )
            ],
        ),
        diff=f"--- a/{path}\n+++ b/{path}\n@@ -1,1 +1,2 @@\n{value}\n",
    )


def _diff_state(*patches: AgentFilePatch) -> SeerRunState:
    return _state(
        blocks=[
            MemoryBlock(
                id="b",
                message=Message(role="assistant", content="c"),
                timestamp="2026-02-10T00:00:00Z",
                merged_file_patches=list(patches),
            )
        ]
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

    def test_repo_pr_states_is_not_a_pr_source(self) -> None:
        # repo_pr_states persists across a re-run, so it must not drive the milestone;
        # only a pr_commit_shas block or a coding-agent pr_number does.
        state = _state(repo_pr_states={"owner/repo": RepoPRState(repo_name="owner/repo")})
        assert SeerRunMilestoneType.HAS_PULL_REQUEST not in milestones_from_state(state)

    def test_root_cause_extras_hold_one_line_description(self) -> None:
        block = MemoryBlock(
            id="b",
            message=Message(role="assistant", content="c"),
            timestamp="2026-02-10T00:00:00Z",
            artifacts=[
                Artifact(key="root_cause", data={"one_line_description": "boom"}, reason="r")
            ],
        )
        result = milestones_from_state(_state(blocks=[block]))
        assert result[SeerRunMilestoneType.ROOT_CAUSE] == {
            "root_cause_artifact": {"one_line_description": "boom"}
        }

    def test_root_cause_extras_hold_headline_when_present(self) -> None:
        block = MemoryBlock(
            id="b",
            message=Message(role="assistant", content="c"),
            timestamp="2026-02-10T00:00:00Z",
            artifacts=[
                Artifact(
                    key="root_cause",
                    data={"one_line_description": "boom", "headline": "Checkout crashes"},
                    reason="r",
                )
            ],
        )
        result = milestones_from_state(_state(blocks=[block]))
        assert result[SeerRunMilestoneType.ROOT_CAUSE] == {
            "root_cause_artifact": {"one_line_description": "boom", "headline": "Checkout crashes"}
        }

    def test_root_cause_extras_omit_blank_headline(self) -> None:
        block = MemoryBlock(
            id="b",
            message=Message(role="assistant", content="c"),
            timestamp="2026-02-10T00:00:00Z",
            artifacts=[
                Artifact(
                    key="root_cause",
                    data={"one_line_description": "boom", "headline": ""},
                    reason="r",
                )
            ],
        )
        result = milestones_from_state(_state(blocks=[block]))
        assert result[SeerRunMilestoneType.ROOT_CAUSE] == {
            "root_cause_artifact": {"one_line_description": "boom"}
        }

    def test_solution_extras_hold_one_line_summary(self) -> None:
        block = MemoryBlock(
            id="b",
            message=Message(role="assistant", content="c"),
            timestamp="2026-02-10T00:00:00Z",
            artifacts=[Artifact(key="solution", data={"one_line_summary": "fix it"}, reason="r")],
        )
        result = milestones_from_state(_state(blocks=[block]))
        assert result[SeerRunMilestoneType.SOLUTION] == {
            "solution_artifact": {"one_line_summary": "fix it"}
        }

    def test_artifact_with_none_data_yields_empty_extras(self) -> None:
        block = MemoryBlock(
            id="b",
            message=Message(role="assistant", content="c"),
            timestamp="2026-02-10T00:00:00Z",
            artifacts=[Artifact(key="root_cause", data=None, reason="r")],
        )
        result = milestones_from_state(_state(blocks=[block]))
        assert result[SeerRunMilestoneType.ROOT_CAUSE] == {}

    def test_non_artifact_milestones_have_empty_extras(self) -> None:
        state = _state(coding_agents={"agent-1": _coding_agent(pr_number=7, pr_url="url")})
        result = milestones_from_state(state)
        assert result[SeerRunMilestoneType.HAS_PULL_REQUEST] == {}

    def test_code_changes_extras_hold_diffs_grouped_by_repo(self) -> None:
        patch = _agent_file_patch()
        result = milestones_from_state(_diff_state(patch))

        assert result[SeerRunMilestoneType.CODE_CHANGES] == {
            "code_changes_artifact": {"diffs_by_repo": {"getsentry/sentry": [patch.dict()]}}
        }

    def test_no_code_changes_milestone_without_merged_file_patches(self) -> None:
        block = MemoryBlock(
            id="b",
            message=Message(role="assistant", content="c"),
            timestamp="2026-02-10T00:00:00Z",
            merged_file_patches=None,
        )
        assert SeerRunMilestoneType.CODE_CHANGES not in milestones_from_state(
            _state(blocks=[block])
        )
        assert SeerRunMilestoneType.CODE_CHANGES not in milestones_from_state(_diff_state())

    def test_extra_unexpected_artifact_field_is_not_stored(self) -> None:
        block = MemoryBlock(
            id="b",
            message=Message(role="assistant", content="c"),
            timestamp="2026-02-10T00:00:00Z",
            artifacts=[
                Artifact(
                    key="root_cause",
                    data={"one_line_description": "x", "new_field": 1},
                    reason="r",
                )
            ],
        )
        result = milestones_from_state(_state(blocks=[block]))
        assert result[SeerRunMilestoneType.ROOT_CAUSE] == {
            "root_cause_artifact": {"one_line_description": "x"}
        }


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

    def _root_cause_state(self, description: str) -> SeerRunState:
        block = MemoryBlock(
            id="b",
            message=Message(role="assistant", content="c"),
            timestamp="2026-02-10T00:00:00Z",
            artifacts=[
                Artifact(key="root_cause", data={"one_line_description": description}, reason="r")
            ],
        )
        return _state(blocks=[block])

    def _extras(self, milestone: str) -> dict[str, object]:
        return SeerRunMilestone.objects.get(seer_run=self.seer_run, milestone=milestone).extras

    def test_reconcile_writes_then_refreshes_extras_on_rerun(self) -> None:
        reconcile_milestones(self.seer_run, self._root_cause_state("first"))
        assert self._extras(SeerRunMilestoneType.ROOT_CAUSE) == {
            "root_cause_artifact": {"one_line_description": "first"}
        }
        reconcile_milestones(self.seer_run, self._root_cause_state("second"))
        assert self._extras(SeerRunMilestoneType.ROOT_CAUSE) == {
            "root_cause_artifact": {"one_line_description": "second"}
        }

    def test_reconcile_persists_code_changes_diffs(self) -> None:
        patch = _agent_file_patch()
        reconcile_milestones(self.seer_run, _diff_state(patch))

        assert self._extras(SeerRunMilestoneType.CODE_CHANGES) == {
            "code_changes_artifact": {"diffs_by_repo": {"getsentry/sentry": [patch.dict()]}}
        }

    def test_reconcile_refreshes_code_changes_diffs_on_rerun(self) -> None:
        reconcile_milestones(self.seer_run, _diff_state(_agent_file_patch(path="a.py")))
        second = _agent_file_patch(path="b.py", value="+other line")
        reconcile_milestones(self.seer_run, _diff_state(second))

        assert self._extras(SeerRunMilestoneType.CODE_CHANGES) == {
            "code_changes_artifact": {"diffs_by_repo": {"getsentry/sentry": [second.dict()]}}
        }

    def test_reconcile_sets_date_updated_on_insert_and_conflict_update(self) -> None:
        with freeze_time("2026-08-05T12:00:00Z"):
            reconcile_milestones(self.seer_run, self._root_cause_state("first"))

        milestone = SeerRunMilestone.objects.get(
            seer_run=self.seer_run, milestone=SeerRunMilestoneType.ROOT_CAUSE
        )
        assert milestone.date_added == datetime(2026, 8, 5, 12, tzinfo=UTC)
        assert milestone.date_updated == datetime(2026, 8, 5, 12, tzinfo=UTC)

        with freeze_time("2026-08-05T13:00:00Z"):
            reconcile_milestones(self.seer_run, self._root_cause_state("second"))

        milestone.refresh_from_db()
        assert milestone.date_added == datetime(2026, 8, 5, 12, tzinfo=UTC)
        assert milestone.date_updated == datetime(2026, 8, 5, 13, tzinfo=UTC)

    def test_reconcile_upserts_milestones_in_deterministic_order(self) -> None:
        with mock.patch.object(
            SeerRunMilestone.objects,
            "bulk_create",
            wraps=SeerRunMilestone.objects.bulk_create,
        ) as bulk_create:
            reconcile_milestones(self.seer_run, _state_reaching(set(SEER_STATE_MILESTONES)))

        rows = bulk_create.call_args.args[0]
        assert [row.milestone for row in rows] == sorted(SEER_STATE_MILESTONES)

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

    def test_records_pr_idempotently_beside_other_milestones(self) -> None:
        reconcile_milestones(self.seer_run, _state_reaching({SeerRunMilestoneType.ROOT_CAUSE}))
        record_has_pull_request(self.seer_run)
        record_has_pull_request(self.seer_run)
        assert self._recorded() == {
            SeerRunMilestoneType.ROOT_CAUSE,
            SeerRunMilestoneType.HAS_PULL_REQUEST,
        }
        assert SeerRunMilestone.objects.filter(seer_run=self.seer_run).count() == 2


class ReconcilePullRequestsMergedMilestoneTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.seer_run = self.create_seer_run(organization=self.organization)
        self.repo = self.create_repo(self.project, name="getsentry/sentry")

    def _recorded(self) -> set[str]:
        return set(
            SeerRunMilestone.objects.filter(seer_run=self.seer_run).values_list(
                "milestone", flat=True
            )
        )

    def _linked_pull_request(self, key: str, state: str) -> None:
        pull_request = self.create_pull_request(
            repository_id=self.repo.id, organization_id=self.organization.id, key=key
        )
        pull_request.update(state=state)
        self.create_seer_run_pull_request(run=self.seer_run, pull_request=pull_request)

    def test_records_when_all_linked_pull_requests_merged(self) -> None:
        self._linked_pull_request("1", PullRequestLifecycleState.MERGED)
        self._linked_pull_request("2", PullRequestLifecycleState.MERGED)

        assert reconcile_pull_requests_merged_milestone(self.seer_run) is True
        assert self._recorded() == {SeerRunMilestoneType.PULL_REQUESTS_MERGED}

    def test_records_when_a_closed_pull_request_is_ignored_and_others_merged(self) -> None:
        self._linked_pull_request("1", PullRequestLifecycleState.CLOSED)
        self._linked_pull_request("2", PullRequestLifecycleState.MERGED)

        assert reconcile_pull_requests_merged_milestone(self.seer_run) is True
        assert self._recorded() == {SeerRunMilestoneType.PULL_REQUESTS_MERGED}

    def test_records_when_a_superseded_pull_request_is_ignored_and_others_merged(self) -> None:
        self._linked_pull_request("1", PullRequestLifecycleState.SUPERSEDED)
        self._linked_pull_request("2", PullRequestLifecycleState.MERGED)

        assert reconcile_pull_requests_merged_milestone(self.seer_run) is True
        assert self._recorded() == {SeerRunMilestoneType.PULL_REQUESTS_MERGED}

    def test_not_recorded_when_a_closed_and_an_open_pull_request(self) -> None:
        self._linked_pull_request("1", PullRequestLifecycleState.CLOSED)
        self._linked_pull_request("2", PullRequestLifecycleState.OPEN)

        assert reconcile_pull_requests_merged_milestone(self.seer_run) is False
        assert self._recorded() == set()

    def test_not_recorded_when_a_linked_pull_request_is_open(self) -> None:
        self._linked_pull_request("1", PullRequestLifecycleState.MERGED)
        self._linked_pull_request("2", PullRequestLifecycleState.OPEN)

        assert reconcile_pull_requests_merged_milestone(self.seer_run) is False
        assert self._recorded() == set()

    def test_removes_milestone_when_an_open_pull_request_is_linked(self) -> None:
        self._linked_pull_request("1", PullRequestLifecycleState.MERGED)
        assert reconcile_pull_requests_merged_milestone(self.seer_run) is True

        self._linked_pull_request("2", PullRequestLifecycleState.OPEN)

        assert reconcile_pull_requests_merged_milestone(self.seer_run) is False
        assert self._recorded() == set()

        pull_request = self.seer_run.pull_requests.get(key="2")
        pull_request.update(state=PullRequestLifecycleState.MERGED)

        assert reconcile_pull_requests_merged_milestone(self.seer_run) is True
        assert self._recorded() == {SeerRunMilestoneType.PULL_REQUESTS_MERGED}

    def test_not_recorded_when_a_linked_pull_request_is_closed_unmerged(self) -> None:
        self._linked_pull_request("1", PullRequestLifecycleState.CLOSED)

        assert reconcile_pull_requests_merged_milestone(self.seer_run) is False
        assert self._recorded() == set()

    def test_not_recorded_without_linked_pull_requests(self) -> None:
        assert reconcile_pull_requests_merged_milestone(self.seer_run) is False
        assert self._recorded() == set()

    def test_idempotent(self) -> None:
        self._linked_pull_request("1", PullRequestLifecycleState.MERGED)

        assert reconcile_pull_requests_merged_milestone(self.seer_run) is True
        assert reconcile_pull_requests_merged_milestone(self.seer_run) is True
        assert (
            SeerRunMilestone.objects.filter(
                seer_run=self.seer_run, milestone=SeerRunMilestoneType.PULL_REQUESTS_MERGED
            ).count()
            == 1
        )

    def test_leaves_state_derived_milestones_untouched(self) -> None:
        reconcile_milestones(self.seer_run, _state_reaching(set(SEER_STATE_MILESTONES)))
        self._linked_pull_request("1", PullRequestLifecycleState.MERGED)

        reconcile_pull_requests_merged_milestone(self.seer_run)

        assert self._recorded() == set(SEER_STATE_MILESTONES) | {
            SeerRunMilestoneType.PULL_REQUESTS_MERGED
        }

    def test_removes_only_pull_requests_merged_milestone(self) -> None:
        reconcile_milestones(self.seer_run, _state_reaching(set(SEER_STATE_MILESTONES)))
        self._linked_pull_request("1", PullRequestLifecycleState.MERGED)
        assert reconcile_pull_requests_merged_milestone(self.seer_run) is True

        self._linked_pull_request("2", PullRequestLifecycleState.OPEN)
        assert reconcile_pull_requests_merged_milestone(self.seer_run) is False

        assert self._recorded() == set(SEER_STATE_MILESTONES)
