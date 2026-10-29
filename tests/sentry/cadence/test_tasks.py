from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import MagicMock, patch

from sentry.cadence.models import ScheduledTrigger, ScheduledTriggerType, ScheduleType
from sentry.cadence.registry import trigger_action_registry
from sentry.cadence.tasks import cadence_tick, execute_scheduled_trigger
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options

NOW = datetime(2024, 3, 9, 12, 0, tzinfo=UTC)


def cadence_metric_calls(mock: MagicMock) -> list[tuple[tuple[Any, ...], dict[str, Any]]]:
    """(args, kwargs) of each call to a metrics mock that recorded a cadence metric."""
    return [
        (c.args, dict(c.kwargs)) for c in mock.call_args_list if c.args[0].startswith("cadence.")
    ]


def test_every_trigger_type_has_an_action() -> None:
    assert set(trigger_action_registry.registrations) == set(ScheduledTriggerType)


class CadenceTaskTestCase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_options({"cadence.tick.enabled": True}))

    def create_trigger(
        self,
        next_run_at: datetime | None = NOW,
        trigger_type: ScheduledTriggerType = ScheduledTriggerType.TRIAGE,
    ) -> ScheduledTrigger:
        return ScheduledTrigger.objects.create(
            organization=self.organization,
            trigger_type=trigger_type,
            schedule_type=ScheduleType.INTERVAL,
            interval_seconds=3600,
            next_run_at=next_run_at,
        )


class CadenceTickTest(CadenceTaskTestCase):
    @freeze_time(NOW)
    @patch("sentry.cadence.tasks.execute_scheduled_trigger.delay")
    def test_dispatches_due_triggers_and_advances(self, mock_delay: MagicMock) -> None:
        due = self.create_trigger(NOW - timedelta(minutes=1))
        future = self.create_trigger(NOW + timedelta(minutes=1))
        unscheduled = self.create_trigger(None)

        cadence_tick()

        mock_delay.assert_called_once_with(due.id, (NOW - timedelta(minutes=1)).isoformat())
        due.refresh_from_db()
        assert due.next_run_at == NOW + timedelta(minutes=59)
        assert due.last_run_at == NOW
        future.refresh_from_db()
        assert future.next_run_at == NOW + timedelta(minutes=1)
        unscheduled.refresh_from_db()
        assert unscheduled.next_run_at is None

    @freeze_time(NOW)
    @patch("sentry.cadence.tasks.execute_scheduled_trigger.delay")
    def test_dispatches_missed_runs_once(self, mock_delay: MagicMock) -> None:
        trigger = self.create_trigger(NOW - timedelta(hours=3, minutes=10))

        cadence_tick()
        cadence_tick()

        assert mock_delay.call_count == 1
        trigger.refresh_from_db()
        assert trigger.next_run_at == NOW + timedelta(minutes=50)

    @freeze_time(NOW)
    @patch("sentry.cadence.tasks.metrics.distribution")
    @patch("sentry.cadence.tasks.execute_scheduled_trigger.delay")
    def test_records_claim_metrics(
        self, mock_delay: MagicMock, mock_distribution: MagicMock
    ) -> None:
        self.create_trigger(NOW - timedelta(seconds=12))
        self.create_trigger(NOW + timedelta(minutes=1))

        cadence_tick()

        assert cadence_metric_calls(mock_distribution) == [
            (
                ("cadence.trigger.claim_lag", 12.0),
                {"tags": {"trigger_type": "triage"}, "unit": "second"},
            ),
            (("cadence.tick.claimed", 1), {}),
        ]

    @freeze_time(NOW)
    @patch("sentry.cadence.tasks.execute_scheduled_trigger.delay")
    def test_dispatches_cron_trigger(self, mock_delay: MagicMock) -> None:
        trigger = ScheduledTrigger.objects.create(
            organization=self.organization,
            trigger_type=ScheduledTriggerType.AUTOMATION,
            schedule_type=ScheduleType.CRON,
            cron_expression="0 * * * *",
            next_run_at=NOW,
        )

        cadence_tick()

        mock_delay.assert_called_once_with(trigger.id, NOW.isoformat())
        trigger.refresh_from_db()
        assert trigger.next_run_at == NOW + timedelta(hours=1)

    @freeze_time(NOW)
    @patch("sentry.cadence.tasks.execute_scheduled_trigger.delay")
    def test_kill_switch(self, mock_delay: MagicMock) -> None:
        trigger = self.create_trigger(NOW - timedelta(minutes=1))

        with override_options({"cadence.tick.enabled": False}):
            cadence_tick()

        mock_delay.assert_not_called()
        trigger.refresh_from_db()
        assert trigger.next_run_at == NOW - timedelta(minutes=1)


class ExecuteScheduledTriggerTest(CadenceTaskTestCase):
    def test_calls_registered_action(self) -> None:
        trigger = self.create_trigger(trigger_type=ScheduledTriggerType.AUTOMATION)
        action = MagicMock()
        with patch.dict(
            trigger_action_registry.registrations, {ScheduledTriggerType.AUTOMATION: action}
        ):
            execute_scheduled_trigger(trigger.id, NOW.isoformat())

        action.assert_called_once_with(trigger.id, NOW)

    def test_kill_switch(self) -> None:
        trigger = self.create_trigger(trigger_type=ScheduledTriggerType.AUTOMATION)
        action = MagicMock()
        with (
            patch.dict(
                trigger_action_registry.registrations, {ScheduledTriggerType.AUTOMATION: action}
            ),
            override_options({"cadence.tick.enabled": False}),
        ):
            execute_scheduled_trigger(trigger.id, NOW.isoformat())

        action.assert_not_called()

    @freeze_time(NOW + timedelta(seconds=7))
    @patch("sentry.utils.metrics.timing")
    @patch("sentry.cadence.tasks.metrics.distribution")
    def test_records_lag_and_duration(
        self, mock_distribution: MagicMock, mock_timing: MagicMock
    ) -> None:
        trigger = self.create_trigger(trigger_type=ScheduledTriggerType.AUTOMATION)
        with patch.dict(
            trigger_action_registry.registrations, {ScheduledTriggerType.AUTOMATION: MagicMock()}
        ):
            execute_scheduled_trigger(trigger.id, NOW.isoformat())

        assert cadence_metric_calls(mock_distribution) == [
            (
                ("cadence.trigger.execute_lag", 7.0),
                {"tags": {"trigger_type": "automation"}, "unit": "second"},
            )
        ]
        ((timing_args, _),) = cadence_metric_calls(mock_timing)
        assert timing_args[0] == "cadence.trigger.execute_duration"
        assert timing_args[3] == {"trigger_type": "automation", "result": "success"}

    @patch("sentry.utils.metrics.timing")
    @patch("sentry.cadence.tasks.logger")
    def test_action_failure_is_contained(
        self, mock_logger: MagicMock, mock_timing: MagicMock
    ) -> None:
        trigger = self.create_trigger(trigger_type=ScheduledTriggerType.AUTOMATION)
        action = MagicMock(side_effect=RuntimeError("boom"))
        with patch.dict(
            trigger_action_registry.registrations, {ScheduledTriggerType.AUTOMATION: action}
        ):
            execute_scheduled_trigger(trigger.id, NOW.isoformat())

        mock_logger.exception.assert_called_once_with(
            "cadence.trigger.execute_failed",
            extra={
                "trigger_id": trigger.id,
                "trigger_type": "automation",
                "scheduled_for": NOW.isoformat(),
            },
        )
        ((timing_args, _),) = cadence_metric_calls(mock_timing)
        assert timing_args[3] == {"trigger_type": "automation", "result": "failure"}

    @patch("sentry.cadence.tasks.logger")
    def test_unregistered_trigger_type_is_contained(self, mock_logger: MagicMock) -> None:
        trigger = self.create_trigger(trigger_type=ScheduledTriggerType.AUTOMATION)
        with patch.dict(trigger_action_registry.registrations, clear=True):
            execute_scheduled_trigger(trigger.id, NOW.isoformat())

        mock_logger.exception.assert_called_once()

    def test_deleted_trigger_is_ignored(self) -> None:
        action = MagicMock()
        with patch.dict(
            trigger_action_registry.registrations, {ScheduledTriggerType.TRIAGE: action}
        ):
            execute_scheduled_trigger(123456789, NOW.isoformat())

        action.assert_not_called()
