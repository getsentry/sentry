import itertools
from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from sentry.cadence.models import ScheduledTrigger, ScheduledTriggerType, ScheduleType
from sentry.cadence.registry import TriggerContext, trigger_action_registry
from sentry.cadence.tasks import _claim_batch, cadence_tick
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options

NOW = datetime(2024, 3, 9, 12, 0, tzinfo=UTC)
SEER_WORKFLOW = ScheduledTriggerType.SEER_WORKFLOW


def cadence_metric_calls(mock: MagicMock) -> list[tuple[tuple[Any, ...], dict[str, Any]]]:
    """(args, kwargs) of each call to a metrics mock that recorded a cadence metric."""
    return [
        (c.args, dict(c.kwargs)) for c in mock.call_args_list if c.args[0].startswith("cadence.")
    ]


def test_every_trigger_type_has_an_action() -> None:
    assert set(trigger_action_registry.registrations) == set(ScheduledTriggerType)


class CadenceTickTest(TestCase):
    @pytest.fixture(autouse=True)
    def action(self) -> Generator[MagicMock]:
        self.action = MagicMock()
        with patch.dict(trigger_action_registry.registrations, {SEER_WORKFLOW: self.action}):
            yield self.action

    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_options({"cadence.tick.enabled": True}))
        self.target_ids = itertools.count(1)

    def create_trigger(self, next_run_at: datetime | None = NOW, **kwargs: Any) -> ScheduledTrigger:
        fields: dict[str, Any] = {
            "schedule_type": ScheduleType.INTERVAL,
            "interval_seconds": 3600,
            **kwargs,
        }
        return ScheduledTrigger.objects.create(
            organization=self.organization,
            trigger_type=SEER_WORKFLOW,
            target_id=next(self.target_ids),
            next_run_at=next_run_at,
            **fields,
        )

    def context(self, trigger: ScheduledTrigger, scheduled_for: datetime) -> TriggerContext:
        return TriggerContext(
            organization_id=self.organization.id,
            trigger_type=SEER_WORKFLOW,
            target_id=trigger.target_id,
            scheduled_for=scheduled_for,
        )

    def dispatched(self) -> list[TriggerContext]:
        return [ctx for call in self.action.call_args_list for ctx in call.args[0]]

    @freeze_time(NOW)
    def test_dispatches_due_triggers_in_one_call_and_advances(self) -> None:
        due_1 = self.create_trigger(NOW - timedelta(minutes=1))
        due_2 = self.create_trigger(NOW)
        future = self.create_trigger(NOW + timedelta(minutes=1))
        unscheduled = self.create_trigger(None)

        cadence_tick()

        self.action.assert_called_once_with(
            [self.context(due_1, NOW - timedelta(minutes=1)), self.context(due_2, NOW)]
        )
        due_1.refresh_from_db()
        assert due_1.next_run_at == NOW + timedelta(minutes=59)
        due_2.refresh_from_db()
        assert due_2.next_run_at == NOW + timedelta(hours=1)
        future.refresh_from_db()
        assert future.next_run_at == NOW + timedelta(minutes=1)
        unscheduled.refresh_from_db()
        assert unscheduled.next_run_at is None

    @freeze_time(NOW)
    def test_dispatches_missed_runs_once(self) -> None:
        trigger = self.create_trigger(NOW - timedelta(hours=3, minutes=10))

        cadence_tick()
        cadence_tick()

        assert self.dispatched() == [self.context(trigger, NOW - timedelta(hours=3, minutes=10))]
        trigger.refresh_from_db()
        assert trigger.next_run_at == NOW + timedelta(minutes=50)

    @freeze_time(NOW)
    def test_dispatches_cron_trigger(self) -> None:
        trigger = self.create_trigger(
            NOW, schedule_type=ScheduleType.CRON, interval_seconds=None, cron_expression="0 * * * *"
        )

        cadence_tick()

        assert self.dispatched() == [self.context(trigger, NOW)]
        trigger.refresh_from_db()
        assert trigger.next_run_at == NOW + timedelta(hours=1)

    @freeze_time(NOW)
    def test_claims_in_batches(self) -> None:
        triggers = [self.create_trigger(NOW - timedelta(minutes=i)) for i in range(5)]

        with patch("sentry.cadence.tasks.TICK_BATCH_SIZE", 2):
            cadence_tick()

        assert self.action.call_count == 3
        assert sorted(ctx.target_id for ctx in self.dispatched()) == sorted(
            t.target_id for t in triggers
        )

    @freeze_time(NOW)
    def test_unschedulable_trigger_does_not_block_others(self) -> None:
        broken = self.create_trigger(
            NOW - timedelta(minutes=2),
            schedule_type=ScheduleType.CRON,
            interval_seconds=None,
            cron_expression="not a cron",
        )
        healthy = self.create_trigger(NOW - timedelta(minutes=1))

        with patch("sentry.cadence.tasks.logger") as mock_logger:
            cadence_tick()

        assert self.dispatched() == [self.context(healthy, NOW - timedelta(minutes=1))]
        mock_logger.exception.assert_called_once()
        broken.refresh_from_db()
        assert broken.next_run_at is None

    @freeze_time(NOW)
    def test_unknown_trigger_type_is_unscheduled(self) -> None:
        stale = self.create_trigger(NOW)
        ScheduledTrigger.objects.filter(id=stale.id).update(trigger_type="removed_type")
        healthy = self.create_trigger(NOW)

        cadence_tick()

        assert self.dispatched() == [self.context(healthy, NOW)]
        stale.refresh_from_db()
        assert stale.next_run_at is None

    @freeze_time(NOW)
    def test_skips_rows_locked_by_a_concurrent_tick(self) -> None:
        trigger = self.create_trigger(NOW)

        with patch.object(
            ScheduledTrigger.objects,
            "select_for_update",
            wraps=ScheduledTrigger.objects.select_for_update,
        ) as select_for_update:
            _claim_batch(NOW)

        select_for_update.assert_called_once_with(skip_locked=True)
        trigger.refresh_from_db()
        assert trigger.next_run_at == NOW + timedelta(hours=1)

    @freeze_time(NOW)
    def test_action_failure_is_contained(self) -> None:
        self.action.side_effect = RuntimeError("boom")
        trigger = self.create_trigger(NOW)

        with (
            patch("sentry.cadence.tasks.logger") as mock_logger,
            patch("sentry.cadence.tasks.metrics.incr") as mock_incr,
        ):
            cadence_tick()

        mock_logger.exception.assert_called_once_with(
            "cadence.trigger.dispatch_failed",
            extra={"trigger_type": "seer_workflow", "run_count": 1},
        )
        mock_incr.assert_called_once_with(
            "cadence.trigger.dispatch_failed", amount=1, tags={"trigger_type": "seer_workflow"}
        )
        # The run is lost, not retried: the trigger has moved on to its next run.
        trigger.refresh_from_db()
        assert trigger.next_run_at == NOW + timedelta(hours=1)

    @freeze_time(NOW)
    def test_unregistered_trigger_type_is_contained(self) -> None:
        self.create_trigger(NOW)

        with (
            patch.dict(trigger_action_registry.registrations, clear=True),
            patch("sentry.cadence.tasks.logger") as mock_logger,
        ):
            cadence_tick()

        mock_logger.exception.assert_called_once()

    @freeze_time(NOW)
    @patch("sentry.utils.metrics.timing")
    @patch("sentry.cadence.tasks.metrics.distribution")
    def test_records_metrics(self, mock_distribution: MagicMock, mock_timing: MagicMock) -> None:
        self.create_trigger(NOW - timedelta(seconds=12))
        self.create_trigger(NOW - timedelta(seconds=5))
        self.create_trigger(NOW + timedelta(minutes=1))

        cadence_tick()

        assert cadence_metric_calls(mock_distribution) == [
            (
                ("cadence.trigger.dispatch_lag", 12.0),
                {"tags": {"trigger_type": "seer_workflow"}, "unit": "second"},
            ),
            (
                ("cadence.trigger.dispatch_lag", 5.0),
                {"tags": {"trigger_type": "seer_workflow"}, "unit": "second"},
            ),
            (("cadence.tick.claimed", 2), {}),
        ]
        ((timing_args, _),) = cadence_metric_calls(mock_timing)
        assert timing_args[0] == "cadence.trigger.dispatch_duration"
        assert timing_args[3] == {"trigger_type": "seer_workflow", "result": "success"}

    @freeze_time(NOW)
    def test_kill_switch(self) -> None:
        trigger = self.create_trigger(NOW - timedelta(minutes=1))

        with override_options({"cadence.tick.enabled": False}):
            cadence_tick()

        self.action.assert_not_called()
        trigger.refresh_from_db()
        assert trigger.next_run_at == NOW - timedelta(minutes=1)
