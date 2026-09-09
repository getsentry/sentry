from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.analytics.events.pr_iteration_events import (
    AiAutofixPrIterationFeedbackBatchBlockedEvent,
    AiAutofixPrIterationFeedbackBatchCompletedEvent,
)
from sentry.seer.agent.client_models import MemoryBlock, Message, SeerRunState
from sentry.seer.autofix.autofix_agent import AutofixStep
from sentry.seer.autofix.pr_iteration.details_store import (
    open_iterations,
    remove_iterations_before,
    update_iteration,
)
from sentry.seer.autofix.pr_iteration.emit import (
    PrIterationOutcome,
    complete_pr_iteration_details,
    discard_pr_iteration_details,
    open_pr_iteration_details,
    outcome_for_failed_run,
    outcome_for_pause,
    record_pr_iteration_blocked,
    record_pr_iteration_counts,
    trigger_pr_iteration_details,
)
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext
from sentry.seer.autofix.pr_iteration.pause import PauseReason
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import assert_last_analytics_event
from sentry.testutils.helpers.datetime import freeze_time

RUN_ID = 4242


def _run_state(*, blocks: list[MemoryBlock] | None = None) -> SeerRunState:
    return SeerRunState(
        run_id=RUN_ID,
        blocks=blocks or [],
        status="completed",
        updated_at="2024-01-01T00:00:00Z",
    )


def _iteration_block(iteration_id: int) -> MemoryBlock:
    return MemoryBlock(
        id="block-0",
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
            run_state=_run_state(),
            organization_id=self.organization.id,
            group_id=self.group.id,
        )

    def _open(self) -> None:
        open_pr_iteration_details(
            log_ctx=self.log_ctx,
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
            )
        return iteration_id

    def _complete(
        self,
        iteration_id: int,
        *,
        outcome: str = PrIterationOutcome.ALREADY_PUSHED.value,
    ) -> None:
        complete_pr_iteration_details(
            log_ctx=self.log_ctx,
            run_state=_run_state(blocks=[_iteration_block(iteration_id)]),
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
                iteration_index=0,
                trigger_source="feedback",
                feedback_count=2,
                queued_count=3,
                dropped_count=1,
                automated_feedback_count=1,
                duration_ms=0,
                outcome="already_pushed",
            ),
        )
        # A surviving row is an iteration still owing an event.
        assert self._open_rows() == []

    def test_the_completion_measures_how_long_the_iteration_took(self) -> None:
        self._open()
        iteration_id = self._trigger()
        assert iteration_id is not None
        (row,) = self._open_rows()
        row.update(date_added=timezone.now() - timedelta(seconds=30))

        with patch("sentry.analytics.record") as mock_record:
            self._complete(iteration_id, outcome=PrIterationOutcome.PUSH_FAILED.value)

        event = mock_record.call_args.args[0]
        assert 30_000 <= event.duration_ms < 60_000
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

    def test_a_second_open_resets_the_row_left_by_an_abandoned_iteration(self) -> None:
        # A pause clears the queue, so the row it opened waits for feedback that never runs.
        self._open()
        (stale,) = self._open_rows()
        stale.update(date_added=timezone.now() - timedelta(hours=2))

        self._open()

        (row,) = self._open_rows()
        assert row.id == stale.id
        assert row.date_added > stale.date_added

    def test_the_reset_row_measures_only_the_iteration_that_claimed_it(self) -> None:
        self._open()
        (stale,) = self._open_rows()
        stale.update(date_added=timezone.now() - timedelta(hours=2))
        self._open()
        iteration_id = self._trigger()
        assert iteration_id is not None

        with patch("sentry.analytics.record") as mock_record:
            self._complete(iteration_id)

        event = mock_record.call_args.args[0]
        assert event.duration_ms < 60_000

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

    def test_a_row_left_behind_is_discarded_unemitted(self) -> None:
        # The iteration never reached a completion hook, so no event is owed.
        self._open()

        with patch("sentry.analytics.record") as mock_record:
            assert remove_iterations_before(timezone.now() + timedelta(minutes=1), 100) == {
                False: 1
            }

        assert not mock_record.called
        assert self._open_rows() == []

    def test_the_sweep_counts_triggered_rows_apart(self) -> None:
        self._open()
        iteration_id = self._trigger()
        assert iteration_id is not None
        self._open()

        assert remove_iterations_before(timezone.now() + timedelta(minutes=1), 100) == {
            True: 1,
            False: 1,
        }

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
                iteration_index=0,
                trigger_source="feedback",
                feedback_count=2,
                queued_count=3,
                dropped_count=1,
                automated_feedback_count=1,
                duration_ms=0,
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
        assert (
            outcome_for_pause(self.log_ctx, PauseReason.USER_STOP)
            == PrIterationOutcome.PAUSED_USER_STOP.value
        )
        assert (
            outcome_for_pause(self.log_ctx, PauseReason.RUN_ERRORED)
            == PrIterationOutcome.PAUSED_RUN_ERRORED.value
        )

    def test_every_pause_reason_has_an_outcome(self) -> None:
        """The two lists drift apart in ``pause``; this is what notices."""
        logger = MagicMock()
        log_ctx = PrIterationLogContext(logger, run_state=_run_state())

        for reason in PauseReason:
            assert outcome_for_pause(log_ctx, reason) != PrIterationOutcome.PAUSED.value

        assert not logger.error.called

    def test_a_pause_reason_added_since_is_recorded_as_a_plain_pause(self) -> None:
        """A batch dropped for a reason with no outcome here is still a batch dropped."""
        logger = MagicMock()
        log_ctx = PrIterationLogContext(logger, run_state=_run_state())

        assert outcome_for_pause(log_ctx, "out_of_credits") == PrIterationOutcome.PAUSED.value
        assert logger.error.call_args.args[0] == "autofix.pr_iteration.details.unknown_pause_reason"
        assert logger.error.call_args.kwargs["extra"]["pause_reason"] == "out_of_credits"

    def test_a_pause_that_names_no_reason_is_still_recorded(self) -> None:
        """A marker written before reasons existed is still a batch we dropped."""
        assert outcome_for_pause(self.log_ctx, None) == PrIterationOutcome.PAUSED.value


class RecordPrIterationBlockedTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=RUN_ID
        )
        self.log_ctx = PrIterationLogContext(
            MagicMock(),
            run_state=_run_state(),
            organization_id=self.organization.id,
            group_id=self.group.id,
        )

    def _open(self) -> None:
        open_pr_iteration_details(
            log_ctx=self.log_ctx,
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
            iteration_index=0,
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
