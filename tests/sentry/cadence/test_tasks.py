import itertools
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import MagicMock, patch

from sentry.cadence.models import ScheduledTrigger, ScheduledTriggerType, ScheduleType
from sentry.cadence.registry import (
    TriggerFiring,
    TriggerTypeRegistration,
    trigger_type_registry,
)
from sentry.cadence.spread import fire_offset, offset_of
from sentry.cadence.tasks import _claim_batch, _Cursor, cadence_tick
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
    assert set(trigger_type_registry.registrations) == set(ScheduledTriggerType)


class CadenceTickTestCase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_options({"cadence.tick.enabled": True}))
        self.action = MagicMock()
        # Fire at scheduled times unless a test registers a spread window.
        self.register(timedelta(0))
        self.target_ids = itertools.count(1)

    def register(self, spread_window: timedelta) -> None:
        registration = TriggerTypeRegistration(action=self.action, spread_window=spread_window)
        self.enterContext(
            patch.dict(trigger_type_registry.registrations, {SEER_WORKFLOW: registration})
        )

    def create_trigger(
        self,
        next_fire_at: datetime | None = NOW,
        next_scheduled_for: datetime | None = None,
        target_id: int | None = None,
        **kwargs: Any,
    ) -> ScheduledTrigger:
        fields: dict[str, Any] = {
            "schedule_type": ScheduleType.INTERVAL,
            "interval_seconds": 3600,
            "min_gap_seconds": 3600,
            **kwargs,
        }
        return ScheduledTrigger.objects.create(
            organization=self.organization,
            trigger_type=SEER_WORKFLOW,
            target_id=target_id or next(self.target_ids),
            next_scheduled_for=next_scheduled_for or next_fire_at,
            next_fire_at=next_fire_at,
            **fields,
        )

    def firing(self, trigger: ScheduledTrigger, scheduled_for: datetime) -> TriggerFiring:
        return TriggerFiring(
            organization_id=self.organization.id,
            trigger_type=SEER_WORKFLOW,
            target_id=trigger.target_id,
            scheduled_for=scheduled_for,
        )

    def dispatched(self) -> list[TriggerFiring]:
        return [ctx for call in self.action.call_args_list for ctx in call.args[0]]


class CadenceTickTest(CadenceTickTestCase):
    @freeze_time(NOW)
    def test_dispatches_due_triggers_in_one_call_and_advances(self) -> None:
        due_1 = self.create_trigger(NOW - timedelta(minutes=1))
        due_2 = self.create_trigger(NOW)
        future = self.create_trigger(NOW + timedelta(minutes=1))
        unscheduled = self.create_trigger(None)

        cadence_tick()

        self.action.assert_called_once_with(
            [self.firing(due_1, NOW - timedelta(minutes=1)), self.firing(due_2, NOW)]
        )
        due_1.refresh_from_db()
        assert due_1.next_fire_at == NOW + timedelta(minutes=59)
        due_2.refresh_from_db()
        assert due_2.next_fire_at == NOW + timedelta(hours=1)
        future.refresh_from_db()
        assert future.next_fire_at == NOW + timedelta(minutes=1)
        unscheduled.refresh_from_db()
        assert unscheduled.next_fire_at is None

    @freeze_time(NOW)
    def test_dispatches_missed_runs_once(self) -> None:
        trigger = self.create_trigger(NOW - timedelta(hours=3, minutes=10))

        cadence_tick()
        cadence_tick()

        assert self.dispatched() == [self.firing(trigger, NOW - timedelta(hours=3, minutes=10))]
        trigger.refresh_from_db()
        assert trigger.next_fire_at == NOW + timedelta(minutes=50)

    @freeze_time(NOW)
    def test_dispatches_cron_trigger(self) -> None:
        trigger = self.create_trigger(
            NOW, schedule_type=ScheduleType.CRON, interval_seconds=None, cron_expression="0 * * * *"
        )

        cadence_tick()

        assert self.dispatched() == [self.firing(trigger, NOW)]
        trigger.refresh_from_db()
        assert trigger.next_fire_at == NOW + timedelta(hours=1)

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
    def test_claims_in_batches_with_tied_fire_times(self) -> None:
        triggers = [self.create_trigger(NOW) for _ in range(5)]

        with patch("sentry.cadence.tasks.TICK_BATCH_SIZE", 2):
            cadence_tick()

        assert self.action.call_count == 3
        assert [ctx.target_id for ctx in self.dispatched()] == [t.target_id for t in triggers]

    @freeze_time(NOW)
    def test_claim_batch_resumes_after_cursor(self) -> None:
        passed = self.create_trigger(NOW - timedelta(minutes=2))
        tied_before = self.create_trigger(NOW - timedelta(minutes=1))
        tied_after = self.create_trigger(NOW - timedelta(minutes=1))
        later = self.create_trigger(NOW)

        claimed, selected, cursor = _claim_batch(
            NOW, _Cursor(fire_at=NOW - timedelta(minutes=1), id=tied_before.id)
        )

        assert selected == 2
        assert [c.firing.target_id for c in claimed[SEER_WORKFLOW]] == [
            tied_after.target_id,
            later.target_id,
        ]
        assert cursor == _Cursor(fire_at=NOW, id=later.id)
        passed.refresh_from_db()
        assert passed.next_fire_at == NOW - timedelta(minutes=2)
        tied_before.refresh_from_db()
        assert tied_before.next_fire_at == NOW - timedelta(minutes=1)

    @freeze_time(NOW)
    def test_claim_batch_with_nothing_due_keeps_cursor(self) -> None:
        self.create_trigger(NOW + timedelta(minutes=1))
        after = _Cursor(fire_at=NOW - timedelta(minutes=1), id=1)

        claimed, selected, cursor = _claim_batch(NOW, after)

        assert claimed == {}
        assert selected == 0
        assert cursor == after

    @freeze_time(NOW)
    def test_stops_claiming_after_time_limit(self) -> None:
        triggers = [self.create_trigger(NOW - timedelta(minutes=i)) for i in range(5)]

        with (
            patch("sentry.cadence.tasks.TICK_BATCH_SIZE", 2),
            patch("sentry.cadence.tasks.TICK_CLAIM_SECONDS", 0),
        ):
            cadence_tick()

        assert self.action.call_count == 1
        assert [ctx.target_id for ctx in self.dispatched()] == [
            triggers[4].target_id,
            triggers[3].target_id,
        ]

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

        assert self.dispatched() == [self.firing(healthy, NOW - timedelta(minutes=1))]
        mock_logger.exception.assert_called_once()
        broken.refresh_from_db()
        assert broken.next_fire_at is None
        assert broken.next_scheduled_for is None

    @freeze_time(NOW)
    def test_unknown_trigger_type_is_unscheduled(self) -> None:
        stale = self.create_trigger(NOW)
        ScheduledTrigger.objects.filter(id=stale.id).update(trigger_type="removed_type")
        healthy = self.create_trigger(NOW)

        cadence_tick()

        assert self.dispatched() == [self.firing(healthy, NOW)]
        stale.refresh_from_db()
        assert stale.next_fire_at is None

    @freeze_time(NOW)
    def test_skips_rows_locked_by_a_concurrent_tick(self) -> None:
        trigger = self.create_trigger(NOW)

        with patch.object(
            ScheduledTrigger.objects,
            "select_for_update",
            wraps=ScheduledTrigger.objects.select_for_update,
        ) as select_for_update:
            _claim_batch(NOW, None)

        select_for_update.assert_called_once_with(skip_locked=True)
        trigger.refresh_from_db()
        assert trigger.next_fire_at == NOW + timedelta(hours=1)

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
            extra={"trigger_type": "seer_workflow", "firing_count": 1},
        )
        mock_incr.assert_called_once_with(
            "cadence.trigger.dispatch_failed", amount=1, tags={"trigger_type": "seer_workflow"}
        )
        # The firing is lost, not retried: the trigger has moved on to its next firing.
        trigger.refresh_from_db()
        assert trigger.next_fire_at == NOW + timedelta(hours=1)

    @freeze_time(NOW)
    def test_unregistered_trigger_type_is_contained(self) -> None:
        trigger = self.create_trigger(NOW)

        with (
            patch.dict(trigger_type_registry.registrations, clear=True),
            patch("sentry.cadence.tasks.logger") as mock_logger,
        ):
            cadence_tick()

        # The firing is lost, but the trigger is kept for when the action is deployed.
        mock_logger.exception.assert_called_once()
        assert mock_logger.exception.call_args.args[0] == "cadence.trigger.dispatch_failed"
        trigger.refresh_from_db()
        assert trigger.next_fire_at == NOW + timedelta(hours=1)

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
        ((timing_args, _),) = [
            c
            for c in cadence_metric_calls(mock_timing)
            if c[0][0] == "cadence.trigger.dispatch_duration"
        ]
        assert timing_args[3] == {"trigger_type": "seer_workflow", "result": "success"}

    @freeze_time(NOW)
    def test_kill_switch(self) -> None:
        trigger = self.create_trigger(NOW - timedelta(minutes=1))

        with override_options({"cadence.tick.enabled": False}):
            cadence_tick()

        self.action.assert_not_called()
        trigger.refresh_from_db()
        assert trigger.next_fire_at == NOW - timedelta(minutes=1)


class CadenceTickSpreadTest(CadenceTickTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.register(timedelta(minutes=10))

    def offset(self, target_id: int) -> timedelta:
        # Test triggers fire hourly, so they can use the whole 10 minute window.
        return fire_offset(
            organization_id=self.organization.id,
            trigger_type=SEER_WORKFLOW,
            target_id=target_id,
            min_gap=timedelta(hours=1),
        )

    def create_offset_trigger(self, **kwargs: Any) -> tuple[ScheduledTrigger, timedelta]:
        """A trigger scheduled for NOW whose offset is well inside its 10 minute window."""
        target_id = next(
            target_id
            for target_id in range(1000, 2000)
            if timedelta(minutes=2) < self.offset(target_id) < timedelta(minutes=8)
        )
        offset = self.offset(target_id)
        trigger = self.create_trigger(
            NOW + offset, next_scheduled_for=NOW, target_id=target_id, **kwargs
        )
        return trigger, offset

    @freeze_time(NOW)
    def test_not_dispatched_before_its_offset_firing(self) -> None:
        self.create_offset_trigger()

        cadence_tick()

        self.action.assert_not_called()

    def test_dispatched_with_scheduled_time_and_keeps_offset(self) -> None:
        trigger, offset = self.create_offset_trigger()

        with freeze_time(NOW + offset):
            cadence_tick()

        assert self.dispatched() == [self.firing(trigger, NOW)]
        trigger.refresh_from_db()
        assert trigger.next_scheduled_for == NOW + timedelta(hours=1)
        assert trigger.next_fire_at == NOW + timedelta(hours=1) + offset

    def test_behind_trigger_keeps_a_scheduled_time_whose_firing_is_still_ahead(self) -> None:
        trigger, offset = self.create_offset_trigger(
            schedule_type=ScheduleType.CRON, interval_seconds=None, cron_expression="0 * * * *"
        )

        # Past the next scheduled time (13:00), but not its offset firing.
        with freeze_time(NOW + timedelta(hours=1, minutes=1)):
            cadence_tick()

        assert self.dispatched() == [self.firing(trigger, NOW)]
        trigger.refresh_from_db()
        assert trigger.next_scheduled_for == NOW + timedelta(hours=1)
        assert trigger.next_fire_at == NOW + timedelta(hours=1) + offset

    def test_changed_spread_window_applies_from_the_next_firing(self) -> None:
        # Stored without an offset, as if the window was added after it was scheduled.
        trigger = self.create_trigger(NOW)
        offset = offset_of(trigger)

        with freeze_time(NOW):
            cadence_tick()

        assert self.dispatched() == [self.firing(trigger, NOW)]
        trigger.refresh_from_db()
        assert trigger.next_fire_at == NOW + timedelta(hours=1) + offset

    @patch("sentry.cadence.tasks.metrics.distribution")
    def test_dispatch_lag_excludes_offset(self, mock_distribution: MagicMock) -> None:
        _, offset = self.create_offset_trigger()

        with freeze_time(NOW + offset + timedelta(seconds=3)):
            cadence_tick()

        assert cadence_metric_calls(mock_distribution)[0] == (
            ("cadence.trigger.dispatch_lag", 3.0),
            {"tags": {"trigger_type": "seer_workflow"}, "unit": "second"},
        )

    def test_frequent_trigger_spreads_over_half_its_gap(self) -> None:
        self.register(timedelta(hours=1))
        trigger = self.create_trigger(NOW, interval_seconds=1800, min_gap_seconds=1800)

        with freeze_time(NOW):
            cadence_tick()

        trigger.refresh_from_db()
        assert trigger.next_scheduled_for == NOW + timedelta(minutes=30)
        assert trigger.next_fire_at is not None
        assert trigger.next_fire_at - trigger.next_scheduled_for < timedelta(minutes=15)
