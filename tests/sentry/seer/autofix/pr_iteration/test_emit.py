from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.analytics.events.pr_iteration_events import (
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
    complete_pr_iteration_details,
    discard_pr_iteration_details,
    open_pr_iteration_details,
    record_pr_iteration_counts,
    trigger_pr_iteration_details,
)
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext
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

    def _trigger(self) -> int | None:
        iteration_id = trigger_pr_iteration_details(
            log_ctx=self.log_ctx, run_id=RUN_ID, organization_id=self.organization.id
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

    def _complete(self, iteration_id: int, *, pushed_changes: bool = True) -> None:
        complete_pr_iteration_details(
            log_ctx=self.log_ctx,
            run_state=_run_state(blocks=[_iteration_block(iteration_id)]),
            organization_id=self.organization.id,
            pushed_changes=pushed_changes,
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
                feedback_count=2,
                queued_count=3,
                dropped_count=1,
                automated_feedback_count=1,
                duration_ms=0,
                pushed_changes=True,
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
            self._complete(iteration_id, pushed_changes=False)

        event = mock_record.call_args.args[0]
        assert 30_000 <= event.duration_ms < 60_000
        assert event.pushed_changes is False

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
