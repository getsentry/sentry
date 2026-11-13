import itertools
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import MagicMock, patch

from sentry.cadence.models import ScheduledTrigger, ScheduledTriggerType, ScheduleType
from sentry.cadence.registry import (
    TriggerFiring,
    TriggerHandler,
    TriggerTarget,
    trigger_type_registry,
)
from sentry.cadence.spread import fire_offset, offset_of
from sentry.cadence.tasks import (
    MISSING_TARGET_CHECK_SETTLE_WINDOW,
    TICK_WINDOW,
    _claim_batch,
    _Cursor,
    cadence_sweep,
    cadence_sweep_worker,
    cadence_tick,
)
from sentry.models.organization import Organization
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


def test_every_trigger_type_has_a_handler() -> None:
    assert set(trigger_type_registry.registrations) == set(ScheduledTriggerType)


class CadenceTickTestCase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_options({"cadence.tick.enabled": True}))
        self.handler = MagicMock(spec=TriggerHandler)
        self.handler.find_missing.return_value = ()
        self.action = self.handler.dispatch
        # Fire at scheduled times unless a test registers a spread window.
        self.register(timedelta(0))
        self.target_ids = itertools.count(1)

    def register(self, spread_window: timedelta) -> None:
        self.handler.spread_window = spread_window
        self.enterContext(
            patch.dict(trigger_type_registry.registrations, {SEER_WORKFLOW: self.handler})
        )

    def create_trigger(
        self,
        next_fire_at: datetime | None = NOW,
        next_scheduled_for: datetime | None = None,
        target_id: int | None = None,
        organization: Organization | None = None,
        **kwargs: Any,
    ) -> ScheduledTrigger:
        fields: dict[str, Any] = {
            "schedule_type": ScheduleType.INTERVAL,
            "interval_seconds": 3600,
            "min_gap_seconds": 3600,
            **kwargs,
        }
        return ScheduledTrigger.objects.create(
            organization=organization or self.organization,
            trigger_type=SEER_WORKFLOW,
            target_id=target_id or next(self.target_ids),
            next_scheduled_for=next_scheduled_for or next_fire_at,
            next_fire_at=next_fire_at,
            **fields,
        )

    def firing(
        self, trigger: ScheduledTrigger, scheduled_for: datetime, next_scheduled_for: datetime
    ) -> TriggerFiring:
        return TriggerFiring(
            organization_id=self.organization.id,
            trigger_type=SEER_WORKFLOW,
            target_id=trigger.target_id,
            scheduled_for=scheduled_for,
            next_scheduled_for=next_scheduled_for,
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
            [
                self.firing(due_1, NOW - timedelta(minutes=1), NOW + timedelta(minutes=59)),
                self.firing(due_2, NOW, NOW + timedelta(hours=1)),
            ]
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
    @patch("sentry.cadence.tasks.metrics.incr")
    def test_counts_missed_cron_firings(self, mock_incr: MagicMock) -> None:
        trigger = self.create_trigger(
            NOW - timedelta(hours=3),
            schedule_type=ScheduleType.CRON,
            interval_seconds=None,
            cron_expression="0 * * * *",
        )

        cadence_sweep_worker()
        cadence_tick()

        assert self.dispatched() == [
            self.firing(trigger, NOW - timedelta(hours=3), NOW + timedelta(hours=1))
        ]
        assert cadence_metric_calls(mock_incr) == [
            (
                ("cadence.trigger.missed",),
                {
                    "amount": 3,
                    "tags": {"trigger_type": "seer_workflow", "source": "sweep"},
                    "sample_rate": 1.0,
                },
            ),
            (
                ("cadence.trigger.dispatched",),
                {
                    "amount": 1,
                    "tags": {"trigger_type": "seer_workflow", "source": "sweep"},
                    "sample_rate": 1.0,
                },
            ),
        ]

    @freeze_time(NOW)
    def test_reports_capped_counts_without_capping_schedule_advancement(self) -> None:
        triggers = [
            self.create_trigger(
                NOW - timedelta(hours=10),
                schedule_type=ScheduleType.CRON,
                interval_seconds=None,
                cron_expression="0 * * * *",
            )
            for _ in range(2)
        ]

        with (
            patch("sentry.cadence.schedule.MAX_MISSED_CRON_FIRINGS", 3),
            patch("sentry.cadence.tasks.MAX_MISSED_CRON_FIRINGS", 3),
            patch("sentry.cadence.tasks.metrics.incr") as mock_incr,
            patch("sentry.cadence.tasks.logger") as mock_logger,
        ):
            cadence_sweep_worker()

        assert self.dispatched() == [
            self.firing(trigger, NOW - timedelta(hours=10), NOW + timedelta(hours=1))
            for trigger in triggers
        ]
        assert cadence_metric_calls(mock_incr) == [
            (
                ("cadence.trigger.missed",),
                {
                    "amount": 6,
                    "tags": {"trigger_type": "seer_workflow", "source": "sweep"},
                    "sample_rate": 1.0,
                },
            ),
            (
                ("cadence.trigger.dispatched",),
                {
                    "amount": 2,
                    "tags": {"trigger_type": "seer_workflow", "source": "sweep"},
                    "sample_rate": 1.0,
                },
            ),
        ]
        mock_logger.warning.assert_called_once_with(
            "cadence.trigger.missed_count_capped",
            extra={"trigger_type": "seer_workflow", "capped_firings": 2, "limit_per_firing": 3},
        )
        assert list(ScheduledTrigger.objects.values_list("next_scheduled_for", flat=True)) == [
            NOW + timedelta(hours=1),
            NOW + timedelta(hours=1),
        ]

    @freeze_time(NOW)
    def test_dispatches_cron_trigger(self) -> None:
        trigger = self.create_trigger(
            NOW, schedule_type=ScheduleType.CRON, interval_seconds=None, cron_expression="0 * * * *"
        )

        cadence_tick()

        assert self.dispatched() == [self.firing(trigger, NOW, NOW + timedelta(hours=1))]
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
            NOW, _Cursor(fire_at=NOW - timedelta(minutes=1), id=tied_before.id), NOW
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

        claimed, selected, cursor = _claim_batch(NOW, after, NOW)

        assert claimed == {}
        assert selected == 0
        assert cursor == after

    @freeze_time(NOW)
    def test_stops_claiming_after_time_limit(self) -> None:
        triggers = [self.create_trigger(NOW - timedelta(minutes=i)) for i in range(5)]

        with (
            patch("sentry.cadence.tasks.TICK_BATCH_SIZE", 2),
            patch("sentry.cadence.tasks.TICK_CLAIM_SECONDS", 0),
            patch("sentry.cadence.tasks.metrics.incr") as mock_incr,
        ):
            cadence_tick()

        assert cadence_metric_calls(mock_incr) == [
            (
                ("cadence.trigger.dispatched",),
                {
                    "amount": 2,
                    "tags": {"trigger_type": "seer_workflow", "source": "tick"},
                    "sample_rate": 1.0,
                },
            ),
            (
                ("cadence.tick.time_limit_reached",),
                {"tags": {"source": "tick"}, "sample_rate": 1.0},
            ),
        ]
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

        assert self.dispatched() == [
            self.firing(healthy, NOW - timedelta(minutes=1), NOW + timedelta(minutes=59))
        ]
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

        assert self.dispatched() == [self.firing(healthy, NOW, NOW + timedelta(hours=1))]
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
            _claim_batch(NOW, None, NOW)

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
            "cadence.trigger.dispatch_failed",
            amount=1,
            tags={"trigger_type": "seer_workflow", "source": "tick"},
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
    @patch("sentry.cadence.tasks.metrics.incr")
    def test_records_metrics(
        self, mock_incr: MagicMock, mock_distribution: MagicMock, mock_timing: MagicMock
    ) -> None:
        self.create_trigger(NOW - timedelta(seconds=12))
        self.create_trigger(NOW - timedelta(seconds=5))
        self.create_trigger(NOW + timedelta(minutes=1))

        cadence_tick()

        assert cadence_metric_calls(mock_distribution) == [
            (
                ("cadence.trigger.dispatch_lag", 12.0),
                {"tags": {"trigger_type": "seer_workflow", "source": "tick"}, "unit": "second"},
            ),
            (
                ("cadence.trigger.dispatch_lag", 5.0),
                {"tags": {"trigger_type": "seer_workflow", "source": "tick"}, "unit": "second"},
            ),
            (("cadence.tick.claimed", 2), {"tags": {"source": "tick"}, "sample_rate": 1.0}),
        ]
        ((timing_args, _),) = [
            c
            for c in cadence_metric_calls(mock_timing)
            if c[0][0] == "cadence.trigger.dispatch_duration"
        ]
        assert timing_args[3] == {
            "trigger_type": "seer_workflow",
            "source": "tick",
            "result": "success",
        }
        assert cadence_metric_calls(mock_incr) == [
            (
                ("cadence.trigger.dispatched",),
                {
                    "amount": 2,
                    "tags": {"trigger_type": "seer_workflow", "source": "tick"},
                    "sample_rate": 1.0,
                },
            ),
        ]

    def test_later_trigger_types_include_time_spent_in_earlier_actions(self) -> None:
        with freeze_time(NOW) as clock:
            self.create_trigger(NOW)
            later = self.create_trigger(NOW, target_id=100)
            ScheduledTrigger.objects.filter(id=later.id).update(
                trigger_type=ScheduledTriggerType.LOG
            )
            self.action.side_effect = lambda _: clock.shift(timedelta(seconds=7))
            with patch("sentry.cadence.tasks.metrics.distribution") as distribution:
                cadence_tick()

        assert cadence_metric_calls(distribution) == [
            (
                ("cadence.trigger.dispatch_lag", 0.0),
                {"tags": {"trigger_type": "seer_workflow", "source": "tick"}, "unit": "second"},
            ),
            (
                ("cadence.trigger.dispatch_lag", 7.0),
                {"tags": {"trigger_type": "log", "source": "tick"}, "unit": "second"},
            ),
            (("cadence.tick.claimed", 2), {"tags": {"source": "tick"}, "sample_rate": 1.0}),
        ]

    @freeze_time(NOW)
    def test_kill_switch(self) -> None:
        trigger = self.create_trigger(NOW - timedelta(minutes=1))

        with override_options({"cadence.tick.enabled": False}):
            cadence_tick()

        self.action.assert_not_called()
        trigger.refresh_from_db()
        assert trigger.next_fire_at == NOW - timedelta(minutes=1)


class CadenceSweepTest(CadenceTickTestCase):
    @freeze_time(NOW)
    def test_tick_ignores_triggers_due_before_its_window(self) -> None:
        old = self.create_trigger(NOW - TICK_WINDOW - timedelta(seconds=1))

        cadence_tick()

        self.action.assert_not_called()
        old.refresh_from_db()
        assert old.next_fire_at == NOW - TICK_WINDOW - timedelta(seconds=1)

    @freeze_time(NOW)
    @patch("sentry.cadence.tasks.metrics.incr")
    def test_sweep_dispatches_missed_runs_once_and_tick_does_not_refire(
        self, mock_incr: MagicMock
    ) -> None:
        trigger = self.create_trigger(NOW - timedelta(hours=12, minutes=10))

        cadence_sweep_worker()
        cadence_tick()

        assert self.dispatched() == [
            self.firing(trigger, NOW - timedelta(hours=12, minutes=10), NOW + timedelta(minutes=50))
        ]
        trigger.refresh_from_db()
        assert trigger.next_fire_at == NOW + timedelta(minutes=50)
        assert cadence_metric_calls(mock_incr) == [
            (
                ("cadence.trigger.missed",),
                {
                    "amount": 12,
                    "tags": {"trigger_type": "seer_workflow", "source": "sweep"},
                    "sample_rate": 1.0,
                },
            ),
            (
                ("cadence.trigger.dispatched",),
                {
                    "amount": 1,
                    "tags": {"trigger_type": "seer_workflow", "source": "sweep"},
                    "sample_rate": 1.0,
                },
            ),
        ]

    @freeze_time(NOW)
    def test_sweep_ignores_triggers_inside_the_tick_window(self) -> None:
        self.create_trigger(NOW - TICK_WINDOW)
        self.create_trigger(NOW)

        cadence_sweep_worker()

        self.action.assert_not_called()

    @freeze_time(NOW)
    def test_boundary_is_claimed_by_exactly_one(self) -> None:
        on_boundary = self.create_trigger(NOW - TICK_WINDOW)
        just_before = self.create_trigger(NOW - TICK_WINDOW - timedelta(microseconds=1))

        cadence_tick()
        assert self.dispatched() == [
            self.firing(on_boundary, NOW - TICK_WINDOW, NOW - TICK_WINDOW + timedelta(hours=1))
        ]

        self.action.reset_mock()
        cadence_sweep_worker()
        assert self.dispatched() == [
            self.firing(
                just_before,
                NOW - TICK_WINDOW - timedelta(microseconds=1),
                NOW - TICK_WINDOW - timedelta(microseconds=1) + timedelta(hours=1),
            )
        ]

    @freeze_time(NOW)
    @patch("sentry.cadence.tasks.metrics.distribution")
    def test_sweep_metrics_are_tagged_by_source(self, mock_distribution: MagicMock) -> None:
        self.create_trigger(NOW - timedelta(hours=1))

        cadence_sweep_worker()

        assert cadence_metric_calls(mock_distribution) == [
            (
                ("cadence.trigger.dispatch_lag", 3600.0),
                {"tags": {"trigger_type": "seer_workflow", "source": "sweep"}, "unit": "second"},
            ),
            (("cadence.tick.claimed", 1), {"tags": {"source": "sweep"}, "sample_rate": 1.0}),
        ]

    @patch("sentry.cadence.tasks.cadence_sweep_worker.delay")
    def test_sweep_enqueues_configured_workers(self, delay: MagicMock) -> None:
        with override_options({"cadence.sweep.workers": 3}):
            cadence_sweep()

        assert delay.call_count == 3

    @freeze_time(NOW)
    @patch("sentry.cadence.tasks.cadence_sweep_worker.delay")
    def test_sweep_runs_a_single_worker_inline(self, delay: MagicMock) -> None:
        trigger = self.create_trigger(NOW - timedelta(hours=1))

        with override_options({"cadence.sweep.workers": 1}):
            cadence_sweep()

        delay.assert_not_called()
        assert self.dispatched() == [
            self.firing(trigger, NOW - timedelta(hours=1), NOW + timedelta(hours=1))
        ]

    @freeze_time(NOW)
    @patch("sentry.cadence.tasks.cadence_sweep_worker.delay")
    def test_sweep_runs_at_least_one_worker(self, delay: MagicMock) -> None:
        trigger = self.create_trigger(NOW - timedelta(hours=1))

        with override_options({"cadence.sweep.workers": 0}):
            cadence_sweep()

        delay.assert_not_called()
        assert self.dispatched() == [
            self.firing(trigger, NOW - timedelta(hours=1), NOW + timedelta(hours=1))
        ]

    @patch("sentry.cadence.tasks.cadence_sweep_worker.delay")
    def test_sweep_kill_switch(self, delay: MagicMock) -> None:
        with override_options({"cadence.tick.enabled": False}):
            cadence_sweep()

        delay.assert_not_called()

    @freeze_time(NOW)
    def test_sweep_worker_kill_switch(self) -> None:
        self.create_trigger(NOW - timedelta(hours=1))

        with override_options({"cadence.tick.enabled": False}):
            cadence_sweep_worker()

        self.action.assert_not_called()


class CadenceTickMissingTargetTest(CadenceTickTestCase):
    def target(self, trigger: ScheduledTrigger) -> TriggerTarget:
        return TriggerTarget(organization_id=trigger.organization_id, target_id=trigger.target_id)

    def create_settled_trigger(
        self, next_fire_at: datetime = NOW, **kwargs: Any
    ) -> ScheduledTrigger:
        """A trigger whose schedule was set just outside the settle window."""
        with freeze_time(NOW - MISSING_TARGET_CHECK_SETTLE_WINDOW):
            return self.create_trigger(next_fire_at, **kwargs)

    @freeze_time(NOW)
    def test_missed_count_excludes_deleted_targets(self) -> None:
        missing = self.create_settled_trigger(NOW - timedelta(hours=3))
        healthy = self.create_settled_trigger(NOW - timedelta(hours=1))
        self.handler.find_missing.return_value = [self.target(missing)]

        with patch("sentry.cadence.tasks.metrics.incr") as mock_incr:
            cadence_sweep_worker()

        assert self.dispatched() == [
            self.firing(healthy, NOW - timedelta(hours=1), NOW + timedelta(hours=1))
        ]
        assert not ScheduledTrigger.objects.filter(id=missing.id).exists()
        missed_calls = [
            c for c in cadence_metric_calls(mock_incr) if c[0][0] == "cadence.trigger.missed"
        ]
        assert missed_calls == [
            (
                ("cadence.trigger.missed",),
                {
                    "amount": 1,
                    "tags": {"trigger_type": "seer_workflow", "source": "sweep"},
                    "sample_rate": 1.0,
                },
            )
        ]

    @freeze_time(NOW)
    def test_drops_and_deletes_triggers_with_missing_targets(self) -> None:
        missing = self.create_settled_trigger()
        healthy = self.create_settled_trigger()
        self.handler.find_missing.return_value = [self.target(missing)]

        with patch("sentry.cadence.tasks.metrics.incr") as mock_incr:
            cadence_tick()

        self.handler.find_missing.assert_called_once_with(
            [self.target(missing), self.target(healthy)]
        )
        assert self.dispatched() == [self.firing(healthy, NOW, NOW + timedelta(hours=1))]
        assert not ScheduledTrigger.objects.filter(id=missing.id).exists()
        assert ScheduledTrigger.objects.filter(id=healthy.id).exists()
        mock_incr.assert_any_call(
            "cadence.trigger.missing_target_deleted",
            amount=1,
            tags={"trigger_type": "seer_workflow", "source": "tick"},
        )

    @freeze_time(NOW)
    def test_does_not_check_triggers_set_within_the_settle_window(self) -> None:
        settled = self.create_settled_trigger()
        with freeze_time(NOW - MISSING_TARGET_CHECK_SETTLE_WINDOW + timedelta(seconds=1)):
            recent = self.create_trigger(NOW)
        self.handler.find_missing.return_value = [self.target(settled), self.target(recent)]

        cadence_tick()

        self.handler.find_missing.assert_called_once_with([self.target(settled)])
        assert self.dispatched() == [self.firing(recent, NOW, NOW + timedelta(hours=1))]
        assert ScheduledTrigger.objects.filter(id=recent.id).exists()

    @freeze_time(NOW)
    def test_firing_does_not_reset_the_settle_window(self) -> None:
        trigger = self.create_settled_trigger()
        date_updated = trigger.date_updated

        cadence_tick()

        trigger.refresh_from_db()
        assert trigger.date_updated == date_updated

    @freeze_time(NOW)
    def test_keeps_a_trigger_set_during_the_check(self) -> None:
        trigger = self.create_settled_trigger()

        def set_during_check(targets: Sequence[TriggerTarget]) -> list[TriggerTarget]:
            ScheduledTrigger.objects.filter(id=trigger.id).update(date_updated=NOW)
            return [self.target(trigger)]

        self.handler.find_missing.side_effect = set_during_check

        cadence_tick()

        assert ScheduledTrigger.objects.filter(id=trigger.id).exists()

    @freeze_time(NOW)
    def test_does_not_check_when_nothing_has_settled(self) -> None:
        trigger = self.create_trigger(NOW)

        cadence_tick()

        self.handler.find_missing.assert_not_called()
        assert self.dispatched() == [self.firing(trigger, NOW, NOW + timedelta(hours=1))]

    @freeze_time(NOW)
    def test_only_deletes_the_missing_organizations_trigger(self) -> None:
        missing = self.create_settled_trigger(target_id=5)
        other_org = self.create_organization()
        same_target = self.create_settled_trigger(target_id=5, organization=other_org)
        self.handler.find_missing.return_value = [self.target(missing)]

        cadence_tick()

        assert [f.organization_id for f in self.dispatched()] == [other_org.id]
        assert not ScheduledTrigger.objects.filter(id=missing.id).exists()
        assert ScheduledTrigger.objects.filter(id=same_target.id).exists()

    @freeze_time(NOW)
    def test_skips_dispatch_when_every_target_is_missing(self) -> None:
        missing = self.create_settled_trigger()
        self.handler.find_missing.return_value = [self.target(missing)]

        cadence_tick()

        self.action.assert_not_called()
        assert not ScheduledTrigger.objects.filter(id=missing.id).exists()

    @freeze_time(NOW)
    def test_ignores_targets_it_did_not_ask_about(self) -> None:
        trigger = self.create_settled_trigger()
        unrelated = self.create_settled_trigger(next_fire_at=NOW + timedelta(minutes=1))
        self.handler.find_missing.return_value = [self.target(unrelated)]

        cadence_tick()

        assert self.dispatched() == [self.firing(trigger, NOW, NOW + timedelta(hours=1))]
        assert ScheduledTrigger.objects.filter(id=unrelated.id).exists()

    @freeze_time(NOW)
    def test_failed_check_hands_off_everything(self) -> None:
        trigger = self.create_settled_trigger()
        self.handler.find_missing.side_effect = RuntimeError("boom")

        with patch("sentry.cadence.tasks.logger") as mock_logger:
            cadence_tick()

        assert self.dispatched() == [self.firing(trigger, NOW, NOW + timedelta(hours=1))]
        assert ScheduledTrigger.objects.filter(id=trigger.id).exists()
        mock_logger.exception.assert_called_once_with(
            "cadence.trigger.missing_target_check_failed",
            extra={"trigger_type": "seer_workflow", "target_count": 1},
        )

    @freeze_time(NOW)
    def test_failed_delete_hands_off_everything(self) -> None:
        missing = self.create_settled_trigger()
        healthy = self.create_settled_trigger()
        self.handler.find_missing.return_value = [self.target(missing)]

        with (
            patch.object(ScheduledTrigger.objects, "filter", side_effect=RuntimeError("boom")),
            patch("sentry.cadence.tasks.logger") as mock_logger,
        ):
            cadence_tick()

        assert self.dispatched() == [
            self.firing(missing, NOW, NOW + timedelta(hours=1)),
            self.firing(healthy, NOW, NOW + timedelta(hours=1)),
        ]
        assert (
            mock_logger.exception.call_args.args[0] == "cadence.trigger.missing_target_check_failed"
        )

    @freeze_time(NOW)
    def test_option_disables_the_check(self) -> None:
        trigger = self.create_settled_trigger()
        self.handler.find_missing.return_value = [self.target(trigger)]

        with override_options({"cadence.missing_target_check.enabled": False}):
            cadence_tick()

        self.handler.find_missing.assert_not_called()
        assert self.dispatched() == [self.firing(trigger, NOW, NOW + timedelta(hours=1))]
        assert ScheduledTrigger.objects.filter(id=trigger.id).exists()


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

        assert self.dispatched() == [self.firing(trigger, NOW, NOW + timedelta(hours=1))]
        trigger.refresh_from_db()
        assert trigger.next_scheduled_for == NOW + timedelta(hours=1)
        assert trigger.next_fire_at == NOW + timedelta(hours=1) + offset

    @patch("sentry.cadence.tasks.metrics.incr")
    def test_behind_trigger_keeps_a_scheduled_time_whose_firing_is_still_ahead(
        self, mock_incr: MagicMock
    ) -> None:
        trigger, offset = self.create_offset_trigger(
            schedule_type=ScheduleType.CRON, interval_seconds=None, cron_expression="0 * * * *"
        )

        # Past the next scheduled time (13:00), but not its offset firing.
        with freeze_time(NOW + timedelta(hours=1, minutes=1)):
            cadence_sweep_worker()

        assert self.dispatched() == [self.firing(trigger, NOW, NOW + timedelta(hours=1))]
        trigger.refresh_from_db()
        assert trigger.next_scheduled_for == NOW + timedelta(hours=1)
        assert trigger.next_fire_at == NOW + timedelta(hours=1) + offset
        assert cadence_metric_calls(mock_incr) == [
            (
                ("cadence.trigger.dispatched",),
                {
                    "amount": 1,
                    "tags": {"trigger_type": "seer_workflow", "source": "sweep"},
                    "sample_rate": 1.0,
                },
            )
        ]

    @patch("sentry.cadence.tasks.metrics.incr")
    def test_missed_count_and_next_time_account_for_spreading(self, mock_incr: MagicMock) -> None:
        trigger, offset = self.create_offset_trigger()

        with freeze_time(NOW + offset + timedelta(hours=2, seconds=3)):
            cadence_sweep_worker()

        assert self.dispatched() == [self.firing(trigger, NOW, NOW + timedelta(hours=3))]
        trigger.refresh_from_db()
        assert trigger.next_fire_at == NOW + timedelta(hours=3) + offset
        assert cadence_metric_calls(mock_incr) == [
            (
                ("cadence.trigger.missed",),
                {
                    "amount": 2,
                    "tags": {"trigger_type": "seer_workflow", "source": "sweep"},
                    "sample_rate": 1.0,
                },
            ),
            (
                ("cadence.trigger.dispatched",),
                {
                    "amount": 1,
                    "tags": {"trigger_type": "seer_workflow", "source": "sweep"},
                    "sample_rate": 1.0,
                },
            ),
        ]

    def test_changed_spread_window_applies_from_the_next_firing(self) -> None:
        # Stored without an offset, as if the window was added after it was scheduled.
        trigger = self.create_trigger(NOW)
        offset = offset_of(trigger)

        with freeze_time(NOW):
            cadence_tick()

        assert self.dispatched() == [self.firing(trigger, NOW, NOW + timedelta(hours=1))]
        trigger.refresh_from_db()
        assert trigger.next_fire_at == NOW + timedelta(hours=1) + offset

    @patch("sentry.cadence.tasks.metrics.distribution")
    def test_dispatch_lag_excludes_offset(self, mock_distribution: MagicMock) -> None:
        _, offset = self.create_offset_trigger()

        with freeze_time(NOW + offset + timedelta(seconds=3)):
            cadence_tick()

        assert cadence_metric_calls(mock_distribution)[0] == (
            ("cadence.trigger.dispatch_lag", 3.0),
            {"tags": {"trigger_type": "seer_workflow", "source": "tick"}, "unit": "second"},
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
