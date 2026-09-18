from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.analytics.events.pr_iteration_events import (
    AiAutofixPrIterationFeedbackBatchBlockedEvent,
    AiAutofixPrIterationFeedbackBatchCompletedEvent,
)
from sentry.seer.agent.client_models import (
    AgentFilePatch,
    FilePatch,
    MemoryBlock,
    Message,
    RepoPRState,
    SeerRunState,
)
from sentry.seer.autofix.pr_iteration.details_store import open_iterations, update_iteration
from sentry.seer.autofix.pr_iteration.emit import (
    FAILURE_REASON_DATA_KEY,
    PrIterationOutcome,
    bootstrap_iteration,
    complete_pr_iteration_details,
    discard_pr_iteration_details,
    outcome_for_failed_run,
    outcome_for_pause,
    record_pr_iteration_blocked,
    record_pr_iteration_counts,
    record_pr_iteration_failure_reason,
    trigger_pr_iteration_details,
)
from sentry.seer.autofix.pr_iteration.logs import LogCtxIteration, PrIterationLogContext
from sentry.seer.autofix.pr_iteration.pause import PauseReason
from sentry.seer.autofix.steps import AutofixStep
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import assert_last_analytics_event
from sentry.testutils.helpers.datetime import freeze_time

RUN_ID = 4242


def _run_state(
    *,
    blocks: list[MemoryBlock] | None = None,
    commit_shas: dict[str, str] | None = None,
) -> SeerRunState:
    return SeerRunState(
        run_id=RUN_ID,
        blocks=blocks or [],
        status="completed",
        updated_at="2024-01-01T00:00:00Z",
        repo_pr_states={
            repo: RepoPRState(repo_name=repo, commit_sha=sha)
            for repo, sha in (commit_shas or {}).items()
        },
    )


def _patch(repo_name: str) -> AgentFilePatch:
    return AgentFilePatch(
        repo_name=repo_name,
        patch=FilePatch(path="src/foo.py", type="M", added=1, removed=0),
    )


def _edit_block(
    block_id: str, *, repos: list[str], pr_commit_shas: dict[str, str] | None = None
) -> MemoryBlock:
    """A follow-on block in the iteration that edited files in ``repos``."""
    return MemoryBlock(
        id=block_id,
        pr_commit_shas=pr_commit_shas,
        merged_file_patches=[_patch(repo) for repo in repos],
        message=Message(role="assistant", content="edit"),
        timestamp="2024-01-01T00:00:00Z",
    )


def _iteration_block(
    iteration_id: int,
    *,
    repos: list[str] | None = None,
    pr_commit_shas: dict[str, str] | None = None,
) -> MemoryBlock:
    return MemoryBlock(
        id="block-0",
        pr_commit_shas=pr_commit_shas,
        merged_file_patches=[_patch(repo) for repo in repos or []],
        message=Message(
            role="assistant",
            content="iteration",
            metadata={
                "step": AutofixStep.PR_ITERATION.value,
                "iteration_index": "0",
                "iteration_id": str(iteration_id),
            },
        ),
        timestamp="2024-01-01T00:00:00Z",
    )


class PrIterationDetailsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=RUN_ID
        )
        self.log_ctx = PrIterationLogContext(
            MagicMock(),
            iteration=LogCtxIteration.TRIGGERED,
            run_state=_run_state(),
            organization_id=self.organization.id,
            group_id=self.group.id,
        )

    def _open(self) -> None:
        bootstrap_iteration(
            logger=MagicMock(),
            run_state=_run_state(),
            organization_id=self.organization.id,
            group_id=self.group.id,
        )

    def _trigger(self, *, trigger_source: str | None = "feedback") -> int | None:
        iteration_id = trigger_pr_iteration_details(
            log_ctx=self.log_ctx,
            run_id=RUN_ID,
            organization_id=self.organization.id,
            trigger_source=trigger_source,
        )
        if iteration_id is not None:
            record_pr_iteration_counts(
                log_ctx=self.log_ctx,
                run_id=RUN_ID,
                organization_id=self.organization.id,
                iteration_id=iteration_id,
                referrer="github_pr_comment",
                feedback_count=2,
                queued_count=3,
                dropped_count=1,
                automated_feedback_count=1,
                feedback_bot_logins=["coderabbitai[bot]"],
            )
        return iteration_id

    def _complete(
        self,
        iteration_id: int,
        *,
        outcome: str = PrIterationOutcome.ALREADY_PUSHED.value,
        repos: list[str] | None = None,
        commit_shas: dict[str, str] | None = None,
        extra_blocks: list[MemoryBlock] | None = None,
    ) -> None:
        complete_pr_iteration_details(
            log_ctx=self.log_ctx,
            run_state=_run_state(
                blocks=[_iteration_block(iteration_id, repos=repos), *(extra_blocks or [])],
                commit_shas=commit_shas,
            ),
            organization_id=self.organization.id,
            outcome=outcome,
        )

    def _open_rows(self) -> list:
        return open_iterations(self.seer_run)

    def test_opening_stores_the_row_without_emitting(self) -> None:
        with patch("sentry.analytics.record") as mock_record:
            self._open()

        assert len(self._open_rows()) == 1
        assert not mock_record.called

    def test_the_trigger_writes_what_the_drain_saw(self) -> None:
        self._open()
        assert self._trigger() is not None

        (row,) = self._open_rows()
        assert row.triggered
        assert row.data["trigger_source"] == "feedback"
        assert row.data["referrer"] == "github_pr_comment"
        assert row.data["feedback_count"] == 2
        assert row.data["queued_count"] == 3
        assert row.data["dropped_count"] == 1
        assert row.data["automated_feedback_count"] == 1
        assert row.data["feedback_bot_logins"] == ["coderabbitai[bot]"]

    def test_a_pushed_iteration_records_the_commit_it_pushed(self) -> None:
        self._open()
        iteration_id = self._trigger()
        assert iteration_id is not None

        with patch("sentry.analytics.record") as mock_record:
            self._complete(
                iteration_id,
                repos=["owner/repo"],
                commit_shas={"owner/repo": "sha-new"},
            )

        assert mock_record.call_args.args[0].head_shas == ["sha-new"]

    def test_the_pushed_commit_wins_over_an_earlier_blocks_commit(self) -> None:
        """A block records the PR head at the time it was created, so it can be stale."""
        self._open()
        iteration_id = self._trigger()
        assert iteration_id is not None
        stale = _edit_block(
            "block-1", repos=["owner/repo"], pr_commit_shas={"owner/repo": "sha-old"}
        )
        pushed = _edit_block("block-2", repos=["owner/repo"])

        with patch("sentry.analytics.record") as mock_record:
            self._complete(
                iteration_id,
                commit_shas={"owner/repo": "sha-new"},
                extra_blocks=[stale, pushed],
            )

        assert mock_record.call_args.args[0].head_shas == ["sha-new"]

    def test_a_multi_repo_iteration_records_every_commit_it_pushed(self) -> None:
        self._open()
        iteration_id = self._trigger()
        assert iteration_id is not None

        with patch("sentry.analytics.record") as mock_record:
            self._complete(
                iteration_id,
                repos=["owner/one", "owner/two"],
                commit_shas={"owner/one": "sha-b", "owner/two": "sha-a"},
            )

        assert mock_record.call_args.args[0].head_shas == ["sha-a", "sha-b"]

    def test_a_repo_the_iteration_did_not_touch_is_left_out(self) -> None:
        self._open()
        iteration_id = self._trigger()
        assert iteration_id is not None

        with patch("sentry.analytics.record") as mock_record:
            self._complete(
                iteration_id,
                repos=["owner/one"],
                commit_shas={"owner/one": "sha-a", "owner/untouched": "sha-z"},
            )

        assert mock_record.call_args.args[0].head_shas == ["sha-a"]

    def test_an_iteration_that_pushed_nothing_records_no_commit(self) -> None:
        self._open()
        iteration_id = self._trigger()
        assert iteration_id is not None

        with patch("sentry.analytics.record") as mock_record:
            self._complete(
                iteration_id,
                outcome=PrIterationOutcome.NO_CODE_CHANGES.value,
                repos=["owner/repo"],
                commit_shas={"owner/repo": "sha-new"},
            )

        assert mock_record.call_args.args[0].head_shas == []

    @freeze_time("2024-01-01 00:00:00")
    def test_the_iteration_it_opened_is_emitted_when_it_completes(self) -> None:
        self._open()
        iteration_id = self._trigger()
        assert iteration_id is not None

        with patch("sentry.analytics.record") as mock_record:
            self._complete(iteration_id)

        assert_last_analytics_event(
            mock_record,
            AiAutofixPrIterationFeedbackBatchCompletedEvent(
                iteration_id=iteration_id,
                organization_id=self.organization.id,
                project_id=self.project.id,
                group_id=self.group.id,
                run_id=RUN_ID,
                referrer="github_pr_comment",
                trigger_source="feedback",
                feedback_count=2,
                queued_count=3,
                dropped_count=1,
                automated_feedback_count=1,
                feedback_bot_logins=["coderabbitai[bot]"],
                head_shas=[],
                outcome="already_pushed",
            ),
        )
        # A surviving row is an iteration still owing an event.
        assert self._open_rows() == []

    def test_the_completion_records_the_outcome_it_ended_with(self) -> None:
        self._open()
        iteration_id = self._trigger()
        assert iteration_id is not None

        with patch("sentry.analytics.record") as mock_record:
            self._complete(iteration_id, outcome=PrIterationOutcome.PUSH_FAILED.value)

        event = mock_record.call_args.args[0]
        assert event.outcome == "push_failed"

    def test_an_incomplete_row_keeps_its_row_and_emits_nothing(self) -> None:
        self._open()
        iteration_id = self._trigger()
        assert iteration_id is not None
        (row,) = self._open_rows()
        row.update(data={k: v for k, v in row.data.items() if k != "project_id"})

        with patch("sentry.analytics.record") as mock_record:
            self._complete(iteration_id)

        assert not mock_record.called
        assert len(self._open_rows()) == 1

    def test_a_second_completion_pass_emits_nothing(self) -> None:
        self._open()
        iteration_id = self._trigger()
        assert iteration_id is not None
        self._complete(iteration_id)

        with patch("sentry.analytics.record") as mock_record:
            self._complete(iteration_id)

        assert not mock_record.called

    def test_only_an_unclaimed_iteration_is_handed_to_a_trigger(self) -> None:
        self._open()
        first = self._trigger()

        # A drain arriving with nothing new to open finds nothing to claim: the
        # iteration already running is not handed out twice.
        assert self._trigger() is None
        assert first is not None

    def test_a_second_open_reuses_the_row_left_by_an_abandoned_iteration(self) -> None:
        # A pause clears the queue, so the row it opened waits for feedback that never
        # runs. The next feedback joins that row rather than opening a second one.
        self._open()
        (stale,) = self._open_rows()
        stale.update(date_added=timezone.now() - timedelta(hours=2))

        self._open()

        (row,) = self._open_rows()
        assert row.id == stale.id

    def test_a_waiting_row_never_doubles_up(self) -> None:
        self._open()
        self._open()
        self._open()

        assert len(self._open_rows()) == 1

    def test_a_triggered_iteration_is_discarded_by_id(self) -> None:
        self._open()
        iteration_id = self._trigger()
        assert iteration_id is not None

        discard_pr_iteration_details(
            log_ctx=self.log_ctx,
            run_id=RUN_ID,
            organization_id=self.organization.id,
            iteration_id=iteration_id,
        )

        assert self._open_rows() == []

    def _fail(self, reason: str, *, iteration_id: int | None = None) -> None:
        record_pr_iteration_failure_reason(
            log_ctx=self.log_ctx,
            run_id=RUN_ID,
            organization_id=self.organization.id,
            reason=reason,
            iteration_id=iteration_id,
        )

    def test_a_refused_trigger_names_its_reason_on_the_waiting_row(self) -> None:
        self._open()

        self._fail("stale_head")

        (row,) = self._open_rows()
        assert row.data[FAILURE_REASON_DATA_KEY] == "stale_head"

    def test_a_reason_goes_on_the_claimed_row_when_the_drain_names_it(self) -> None:
        self._open()
        iteration_id = self._trigger()
        assert iteration_id is not None
        # Feedback for the next batch is waiting; the drain's reason must not land there.
        self._open()

        self._fail("no_consumable_feedback", iteration_id=iteration_id)

        claimed, waiting = self._open_rows()
        assert claimed.id == iteration_id
        assert claimed.data[FAILURE_REASON_DATA_KEY] == "no_consumable_feedback"
        assert FAILURE_REASON_DATA_KEY not in waiting.data

    def test_a_batch_that_runs_after_a_refusal_completes_normally(self) -> None:
        # A stale suite was refused, then a fresh one drained the same row: the
        # completed event is the record, and the old reason does not leak into it.
        self._open()
        self._fail("stale_head")
        iteration_id = self._trigger()
        assert iteration_id is not None

        with patch("sentry.analytics.record") as mock_record:
            self._complete(iteration_id)

        event = mock_record.call_args.args[0]
        assert isinstance(event, AiAutofixPrIterationFeedbackBatchCompletedEvent)
        assert event.outcome == PrIterationOutcome.ALREADY_PUSHED.value
        assert self._open_rows() == []

    def test_an_unknown_field_never_reaches_the_event(self) -> None:
        self._open()
        iteration_id = self._trigger()
        assert iteration_id is not None
        (row,) = self._open_rows()
        update_iteration(row, surprise="value")

        with patch("sentry.analytics.record") as mock_record:
            self._complete(iteration_id)

        assert mock_record.called

    @freeze_time("2024-01-01 00:00:00")
    def test_an_iteration_that_produced_nothing_records_that_outcome(self) -> None:
        self._open()
        iteration_id = self._trigger()
        assert iteration_id is not None

        with patch("sentry.analytics.record") as mock_record:
            self._complete(iteration_id, outcome=PrIterationOutcome.NO_CODE_CHANGES.value)

        assert_last_analytics_event(
            mock_record,
            AiAutofixPrIterationFeedbackBatchCompletedEvent(
                iteration_id=iteration_id,
                organization_id=self.organization.id,
                project_id=self.project.id,
                group_id=self.group.id,
                run_id=RUN_ID,
                referrer="github_pr_comment",
                trigger_source="feedback",
                feedback_count=2,
                queued_count=3,
                dropped_count=1,
                automated_feedback_count=1,
                feedback_bot_logins=["coderabbitai[bot]"],
                head_shas=[],
                outcome="no_code_changes",
            ),
        )
        assert self._open_rows() == []

    def test_a_second_ending_emits_nothing(self) -> None:
        """The row is the claim: one batch never lands under two outcomes."""
        self._open()
        iteration_id = self._trigger()
        assert iteration_id is not None
        self._complete(iteration_id)

        with patch("sentry.analytics.record") as mock_record:
            self._complete(iteration_id, outcome=PrIterationOutcome.TIMEOUT.value)

        assert not mock_record.called

    def test_seers_reason_is_the_outcome_of_a_failed_run(self) -> None:
        state = _run_state()
        state.status = "error"
        state.failure_reason = "stalled"

        assert outcome_for_failed_run(state) == PrIterationOutcome.STALLED.value

    def test_a_failure_seer_did_not_classify_is_recorded_as_errored(self) -> None:
        state = _run_state()
        state.status = "error"

        assert outcome_for_failed_run(state) == PrIterationOutcome.ERRORED.value

    def test_a_reason_seer_added_since_is_passed_through(self) -> None:
        """Folding an unknown reason into ``errored`` would hide a new failure."""
        state = _run_state()
        state.status = "error"
        state.failure_reason = "out_of_credits"

        assert outcome_for_failed_run(state) == "out_of_credits"

    def test_a_pause_is_recorded_under_its_reason(self) -> None:
        assert outcome_for_pause(PauseReason.USER_STOP) == PrIterationOutcome.PAUSED_USER_STOP
        assert outcome_for_pause(PauseReason.RUN_ERRORED) == PrIterationOutcome.PAUSED_RUN_ERRORED
        assert outcome_for_pause(PauseReason.PR_CLOSED) == PrIterationOutcome.PAUSED_PR_CLOSED

    def test_every_pause_reason_maps_to_its_own_outcome(self) -> None:
        """Each reason has a distinct ``PAUSED_`` outcome; none share one."""
        outcomes = {outcome_for_pause(reason) for reason in PauseReason}

        assert len(outcomes) == len(PauseReason)
        for outcome in outcomes:
            assert outcome.value.startswith("paused_")


class RecordPrIterationBlockedTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=RUN_ID
        )
        self.log_ctx = PrIterationLogContext(
            MagicMock(),
            iteration=LogCtxIteration.UNTRIGGERED,
            run_state=_run_state(),
            organization_id=self.organization.id,
            group_id=self.group.id,
        )

    def _open(self) -> None:
        bootstrap_iteration(
            logger=self.log_ctx.logger,
            run_state=_run_state(),
            organization_id=self.organization.id,
            group_id=self.group.id,
        )

    def _trigger(self) -> int:
        iteration_id = trigger_pr_iteration_details(
            log_ctx=self.log_ctx,
            run_id=RUN_ID,
            organization_id=self.organization.id,
            trigger_source="feedback",
        )
        assert iteration_id is not None
        record_pr_iteration_counts(
            log_ctx=self.log_ctx,
            run_id=RUN_ID,
            organization_id=self.organization.id,
            iteration_id=iteration_id,
            referrer="github_pr_comment",
            feedback_count=2,
            queued_count=3,
            dropped_count=1,
            automated_feedback_count=1,
            feedback_bot_logins=[],
        )
        return iteration_id

    def _record(self, outcome: str = PrIterationOutcome.MISSING_PERMISSIONS.value) -> None:
        record_pr_iteration_blocked(
            log_ctx=self.log_ctx,
            run_state=_run_state(),
            run_id=RUN_ID,
            organization_id=self.organization.id,
            outcome=outcome,
        )

    def _blocked_event(
        self, iteration_id: int, outcome: str
    ) -> AiAutofixPrIterationFeedbackBatchBlockedEvent:
        return AiAutofixPrIterationFeedbackBatchBlockedEvent(
            iteration_id=iteration_id,
            organization_id=self.organization.id,
            project_id=self.project.id,
            group_id=self.group.id,
            run_id=RUN_ID,
            duration_ms=0,
            outcome=outcome,
        )

    @freeze_time("2024-01-01 00:00:00")
    def test_records_the_outcome_without_claiming_the_row(self) -> None:
        self._open()
        (row,) = open_iterations(self.seer_run)

        with patch("sentry.analytics.record") as mock_record:
            self._record()

        assert_last_analytics_event(
            mock_record,
            self._blocked_event(row.id, PrIterationOutcome.MISSING_PERMISSIONS.value),
        )
        # The row survives: the batch still owes its completion once the block
        # clears and it actually reaches the agent.
        assert len(open_iterations(self.seer_run)) == 1

    @freeze_time("2024-01-01 00:00:00")
    def test_leaves_the_drains_fields_on_the_row(self) -> None:
        """A blocked batch reports what it is, not a run that reported nothing.

        The row can already hold the drain's fields, from a batch blocked on a
        re-check after one drain claimed it. They stay on the row for the
        completed event.
        """
        self._open()
        (row,) = open_iterations(self.seer_run)
        update_iteration(row, referrer="github_pr_comment", feedback_count=2)

        with patch("sentry.analytics.record") as mock_record:
            self._record()

        assert_last_analytics_event(
            mock_record,
            self._blocked_event(row.id, PrIterationOutcome.MISSING_PERMISSIONS.value),
        )
        assert row.data["referrer"] == "github_pr_comment"

    @freeze_time("2024-01-01 00:00:00")
    def test_records_each_outcome_once_per_iteration(self) -> None:
        self._open()

        with patch("sentry.analytics.record") as mock_record:
            self._record()
            self._record()
            self._record(outcome="something_else")

        (row,) = open_iterations(self.seer_run)
        assert [call.args[0] for call in mock_record.call_args_list] == [
            self._blocked_event(row.id, PrIterationOutcome.MISSING_PERMISSIONS.value),
            self._blocked_event(row.id, "something_else"),
        ]
        assert row.data["blocked_outcomes"] == ["missing_permissions", "something_else"]

    @freeze_time("2024-01-01 00:00:00")
    def test_the_next_iteration_records_the_outcome_again(self) -> None:
        self._open()
        self._record()
        first_id = self._trigger()

        self._open()
        with patch("sentry.analytics.record") as mock_record:
            self._record()

        second = next(row for row in open_iterations(self.seer_run) if row.id != first_id)
        assert_last_analytics_event(
            mock_record,
            self._blocked_event(second.id, PrIterationOutcome.MISSING_PERMISSIONS.value),
        )

    def test_a_completion_ignores_the_recorded_outcomes(self) -> None:
        self._open()
        self._record()
        iteration_id = self._trigger()

        with patch("sentry.analytics.record") as mock_record:
            complete_pr_iteration_details(
                log_ctx=self.log_ctx,
                run_state=_run_state(blocks=[_iteration_block(iteration_id)]),
                organization_id=self.organization.id,
                outcome=PrIterationOutcome.ALREADY_PUSHED.value,
            )

        # The bookkeeping key is not a field, so it neither reaches the event
        # nor stops it being built.
        assert mock_record.call_args.args[0].outcome == PrIterationOutcome.ALREADY_PUSHED.value
        assert not open_iterations(self.seer_run)

    def test_no_row_records_nothing(self) -> None:
        with patch("sentry.analytics.record") as mock_record:
            self._record()

        assert not mock_record.called

    def test_no_seer_run_records_nothing(self) -> None:
        self.seer_run.delete()

        with patch("sentry.analytics.record") as mock_record:
            self._record()

        assert not mock_record.called
