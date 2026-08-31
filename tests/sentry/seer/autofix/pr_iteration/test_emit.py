from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.analytics.events.pr_iteration_events import AiAutofixPrIterationDetailsCompletedEvent
from sentry.seer.agent.client_models import MemoryBlock, Message, SeerRunState
from sentry.seer.autofix.autofix_agent import AutofixStep
from sentry.seer.autofix.pr_iteration.details_store import (
    open_iterations,
    remove_iterations_before,
)
from sentry.seer.autofix.pr_iteration.emit import (
    complete_pr_iteration_details,
    open_pr_iteration_details,
    trigger_pr_iteration_details,
)
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import assert_last_analytics_event

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

    def _open_rows(self) -> list:
        return open_iterations(self.seer_run)

    def test_opening_stores_the_row_without_emitting(self) -> None:
        with patch("sentry.analytics.record") as mock_record:
            self._open()

        assert len(self._open_rows()) == 1
        assert not mock_record.called

    def test_the_iteration_it_opened_is_emitted_when_it_completes(self) -> None:
        self._open()
        iteration_id = trigger_pr_iteration_details(
            run_id=RUN_ID, organization_id=self.organization.id
        )
        assert iteration_id is not None

        with patch("sentry.analytics.record") as mock_record:
            complete_pr_iteration_details(
                log_ctx=self.log_ctx,
                run_state=_run_state(blocks=[_iteration_block(iteration_id)]),
                organization_id=self.organization.id,
            )

        assert_last_analytics_event(
            mock_record,
            AiAutofixPrIterationDetailsCompletedEvent(
                iteration_id=iteration_id,
                organization_id=self.organization.id,
                project_id=self.project.id,
                group_id=self.group.id,
                run_id=RUN_ID,
            ),
        )
        # A surviving row is an iteration still owing an event.
        assert self._open_rows() == []

    def test_a_second_completion_pass_emits_nothing(self) -> None:
        self._open()
        iteration_id = trigger_pr_iteration_details(
            run_id=RUN_ID, organization_id=self.organization.id
        )
        assert iteration_id is not None
        state = _run_state(blocks=[_iteration_block(iteration_id)])
        complete_pr_iteration_details(
            log_ctx=self.log_ctx, run_state=state, organization_id=self.organization.id
        )

        with patch("sentry.analytics.record") as mock_record:
            complete_pr_iteration_details(
                log_ctx=self.log_ctx, run_state=state, organization_id=self.organization.id
            )

        assert not mock_record.called

    def test_only_an_unclaimed_iteration_is_handed_to_a_trigger(self) -> None:
        self._open()
        first = trigger_pr_iteration_details(run_id=RUN_ID, organization_id=self.organization.id)

        # A drain arriving with nothing new to open finds nothing to claim: the
        # iteration already running is not handed out twice.
        assert (
            trigger_pr_iteration_details(run_id=RUN_ID, organization_id=self.organization.id)
            is None
        )
        assert first is not None

    def test_a_row_left_behind_is_discarded_unemitted(self) -> None:
        # The iteration never reached a completion hook, so no event is owed.
        self._open()

        with patch("sentry.analytics.record") as mock_record:
            assert remove_iterations_before(timezone.now() + timedelta(minutes=1), 100) == 1

        assert not mock_record.called
        assert self._open_rows() == []
