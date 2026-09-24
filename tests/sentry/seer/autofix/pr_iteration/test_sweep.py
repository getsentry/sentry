from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.analytics.events.pr_iteration_events import (
    AiAutofixPrIterationFeedbackBatchBlockedEvent,
)
from sentry.seer.agent.client_models import MemoryBlock, RepoPRState, SeerRunState
from sentry.seer.autofix.pr_iteration.details_store import open_iterations
from sentry.seer.autofix.pr_iteration.emit import (
    PrIterationOutcome,
    bootstrap_iteration,
    record_pr_iteration_blocked,
    record_pr_iteration_counts,
    record_pr_iteration_failure_reason,
    trigger_pr_iteration_details,
)
from sentry.seer.autofix.pr_iteration.logs import LogCtxIteration, PrIterationLogContext
from sentry.seer.autofix.pr_iteration.sweep import (
    STALE_DETAILS_AGE,
    SweepResult,
    sweep_stale_pr_iterations,
)
from sentry.seer.models.run import SeerRunPrIteration
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import assert_last_analytics_event

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


class SweepStalePrIterationsTest(TestCase):
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

    def _fail(self, reason: str, *, iteration_id: int | None = None) -> None:
        record_pr_iteration_failure_reason(
            log_ctx=self.log_ctx,
            run_id=RUN_ID,
            organization_id=self.organization.id,
            reason=reason,
            iteration_id=iteration_id,
        )

    def _open_rows(self) -> list:
        return open_iterations(self.seer_run)

    def _sweep(self) -> SweepResult:
        """Age every row past the cutoff, then sweep."""
        SeerRunPrIteration.objects.update(
            date_updated=timezone.now() - STALE_DETAILS_AGE - timedelta(minutes=1)
        )
        return sweep_stale_pr_iterations()

    def test_a_row_left_behind_is_emitted_as_never_triggered(self) -> None:
        # No gate ever ruled on this batch and no drain took it: the sweep is
        # the only thing that will ever say it existed.
        self._open()
        (row,) = self._open_rows()

        with patch("sentry.analytics.record") as mock_record:
            assert self._sweep() == SweepResult(discarded=1, emitted=1, backlog=1)

        assert_last_analytics_event(
            mock_record,
            AiAutofixPrIterationFeedbackBatchBlockedEvent(
                iteration_id=row.id,
                organization_id=self.organization.id,
                project_id=self.project.id,
                group_id=self.group.id,
                run_id=RUN_ID,
                duration_ms=0,
                outcome=PrIterationOutcome.NEVER_TRIGGERED.value,
            ),
            exclude_fields=["duration_ms"],
        )
        assert self._open_rows() == []

    def test_a_triggered_row_left_behind_is_emitted_as_never_completed(self) -> None:
        self._open()
        assert self._trigger() is not None

        with patch("sentry.analytics.record") as mock_record:
            assert self._sweep() == SweepResult(discarded=1, emitted=1, backlog=1)

        assert mock_record.call_args.args[0].outcome == PrIterationOutcome.NEVER_COMPLETED.value

    def test_the_sweep_emits_the_reason_the_last_gate_wrote(self) -> None:
        self._open()
        self._fail("hard_cap_reached")
        self._fail("stale_head")

        with patch("sentry.analytics.record") as mock_record:
            self._sweep()

        assert mock_record.call_args.args[0].outcome == "stale_head"

    def test_a_refusal_before_the_trigger_does_not_hide_never_completed(self) -> None:
        self._open()
        self._fail("stale_head")
        assert self._trigger() is not None

        with patch("sentry.analytics.record") as mock_record:
            self._sweep()

        assert mock_record.call_args.args[0].outcome == PrIterationOutcome.NEVER_COMPLETED.value

    def test_a_row_the_completion_hook_claimed_first_is_not_reported_again(self) -> None:
        self._open()

        with (
            patch("sentry.seer.autofix.pr_iteration.sweep.remove_iteration", return_value=False),
            patch("sentry.analytics.record") as mock_record,
        ):
            assert self._sweep() == SweepResult(discarded=0, emitted=0, backlog=1)

        assert not mock_record.called

    def test_a_row_that_already_reported_a_block_is_swept_quietly(self) -> None:
        self._open()
        record_pr_iteration_blocked(
            log_ctx=self.log_ctx,
            run_state=_run_state(),
            run_id=RUN_ID,
            organization_id=self.organization.id,
            outcome=PrIterationOutcome.PAUSED_USER_STOP.value,
        )

        with patch("sentry.analytics.record") as mock_record:
            assert self._sweep() == SweepResult(discarded=1, emitted=0, backlog=1)

        assert not mock_record.called
        assert self._open_rows() == []

    def test_a_fresh_row_is_left_alone(self) -> None:
        self._open()

        with patch("sentry.analytics.record") as mock_record:
            assert sweep_stale_pr_iterations() == SweepResult(discarded=0, emitted=0, backlog=0)

        assert not mock_record.called
        assert len(self._open_rows()) == 1
