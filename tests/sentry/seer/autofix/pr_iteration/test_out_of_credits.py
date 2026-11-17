from typing import Literal

from sentry.seer.agent.client_models import (
    AgentFilePatch,
    FilePatch,
    MemoryBlock,
    Message,
    RepoPRState,
    SeerRunState,
)
from sentry.seer.autofix.pr_iteration.out_of_credits import (
    OUT_OF_CREDITS_EXTRA,
    OutOfCreditsMarker,
    PrIterationOutOfCredits,
    StrandedAction,
    get_out_of_credits,
    mark_out_of_credits,
    pr_iteration_out_of_credits,
    take_out_of_credits,
)
from sentry.seer.autofix.steps import AutofixStep
from sentry.testutils.cases import TestCase

RUN_ID = 67890
REPO = "owner/repo"


class OutOfCreditsMarkerTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=RUN_ID, user_id=self.user.id
        )

    def _mark(self, stranded_action: StrandedAction | None = None) -> bool:
        return mark_out_of_credits(
            run_id=RUN_ID, organization_id=self.organization.id, stranded_action=stranded_action
        )

    def _take(self) -> OutOfCreditsMarker | None:
        return take_out_of_credits(run_id=RUN_ID, organization_id=self.organization.id)

    def test_mark_keeps_a_recorded_stranded_action(self) -> None:
        self._mark(StrandedAction.PUSH)
        self._mark()

        assert get_out_of_credits(
            run_id=RUN_ID, organization_id=self.organization.id
        ) == OutOfCreditsMarker(stranded_action=StrandedAction.PUSH)

    def test_take_returns_the_marker_once(self) -> None:
        assert self._take() is None
        assert self._mark(StrandedAction.BRANCH_MOVED_RETRY) is True

        assert self._take() == OutOfCreditsMarker(stranded_action=StrandedAction.BRANCH_MOVED_RETRY)
        assert self._take() is None

    def test_mark_returns_false_for_another_organization(self) -> None:
        other_org = self.create_organization()

        assert (
            mark_out_of_credits(
                run_id=RUN_ID, organization_id=other_org.id, stranded_action=StrandedAction.PUSH
            )
            is False
        )
        assert self._take() is None

    def test_an_unknown_stranded_action_still_marks_the_run(self) -> None:
        self.seer_run.update(extras={OUT_OF_CREDITS_EXTRA: {"stranded_action": "something_new"}})

        assert self._take() == OutOfCreditsMarker(stranded_action=None)


class PrIterationOutOfCreditsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=RUN_ID, user_id=self.user.id
        )

    def _block(
        self, step: str, merged_file_patches: list[AgentFilePatch] | None = None
    ) -> MemoryBlock:
        return MemoryBlock(
            id=f"{step}-block",
            message=Message(
                role="assistant",
                metadata={"step": step, "iteration_index": "1", "feedback": "fix it"},
            ),
            timestamp="2024-01-01T00:00:00Z",
            merged_file_patches=merged_file_patches,
        )

    def _iteration_block(self) -> MemoryBlock:
        return self._block(AutofixStep.PR_ITERATION.value)

    def _unpushed_iteration_block(self) -> MemoryBlock:
        return self._block(
            AutofixStep.PR_ITERATION.value,
            merged_file_patches=[
                AgentFilePatch(
                    repo_name=REPO,
                    patch=FilePatch(path="src/sentry/foo.py", type="M", added=1, removed=0),
                )
            ],
        )

    def _state(
        self,
        blocks: list[MemoryBlock],
        *,
        status: Literal["processing", "completed", "error", "awaiting_user_input"] = "completed",
        failure_reason: str | None = None,
        pr_state: RepoPRState | None = None,
    ) -> SeerRunState:
        return SeerRunState(
            run_id=RUN_ID,
            blocks=blocks,
            status=status,
            failure_reason=failure_reason,
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={REPO: pr_state or RepoPRState(repo_name=REPO, commit_sha="abc")},
        )

    def _mark(self, stranded_action: StrandedAction | None = None) -> None:
        mark_out_of_credits(
            run_id=RUN_ID, organization_id=self.organization.id, stranded_action=stranded_action
        )

    def _seer_push_error(self) -> RepoPRState:
        # Seer tried to push and ran out of credits.
        return RepoPRState(
            repo_name=REPO,
            commit_sha="abc",
            pr_creation_status="error",
            pr_creation_error_code="out_of_credits",
        )

    def _out_of_credits(self, state: SeerRunState) -> PrIterationOutOfCredits | None:
        self.seer_run.refresh_from_db()
        return pr_iteration_out_of_credits(state, self.seer_run)

    def test_reports_out_of_credits_when_the_run_is_marked(self) -> None:
        assert self._out_of_credits(self._state([])) is None

        self._mark()

        assert self._out_of_credits(self._state([])) == PrIterationOutOfCredits(
            unfinished_action=None
        )

    def test_reports_a_stranded_push_when_unpushed(self) -> None:
        self._mark(StrandedAction.PUSH)

        assert self._out_of_credits(
            self._state([self._unpushed_iteration_block()])
        ) == PrIterationOutOfCredits(unfinished_action="push")

    def test_reports_a_seer_push_error(self) -> None:
        self._mark()
        state = self._state([self._iteration_block()], pr_state=self._seer_push_error())

        assert self._out_of_credits(state) == PrIterationOutOfCredits(unfinished_action="push")

    def test_reports_an_iteration_turn_error(self) -> None:
        self._mark()
        state = self._state(
            [self._iteration_block()], status="error", failure_reason="out_of_credits"
        )

        assert self._out_of_credits(state) == PrIterationOutOfCredits(
            unfinished_action="agent_turn"
        )

    def test_ignores_a_seer_push_error_when_the_run_is_not_marked(self) -> None:
        # Eg, a drain took the marker and the next iteration ended without pushing.
        state = self._state([self._iteration_block()], pr_state=self._seer_push_error())

        assert self._out_of_credits(state) is None

    def test_ignores_a_seer_push_error_when_a_turn_runs(self) -> None:
        # Seer keeps the push error until its next push starts.
        self._mark()
        state = self._state(
            [self._iteration_block()], status="processing", pr_state=self._seer_push_error()
        )

        assert self._out_of_credits(state) is None

    def test_ignores_a_single_run_reply_error(self) -> None:
        self._mark()
        state = self._state(
            [self._iteration_block(), self._block("single_run")],
            status="error",
            failure_reason="out_of_credits",
        )

        assert self._out_of_credits(state) == PrIterationOutOfCredits(unfinished_action=None)

    def test_ignores_a_stranded_push_when_pushed(self) -> None:
        # Eg, retry PR pushed the changes without taking the marker.
        self._mark(StrandedAction.PUSH)

        assert self._out_of_credits(
            self._state([self._iteration_block()])
        ) == PrIterationOutOfCredits(unfinished_action=None)
