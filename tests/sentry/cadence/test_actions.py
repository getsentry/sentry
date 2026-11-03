from datetime import UTC, datetime, timedelta
from unittest.mock import call, patch

from sentry.cadence.models import ScheduledTriggerType
from sentry.cadence.registry import TriggerContext, trigger_type_registry
from sentry.testutils.helpers.datetime import freeze_time

NOW = datetime(2024, 3, 9, 12, 0, tzinfo=UTC)


def test_log_runs_are_spread() -> None:
    assert trigger_type_registry.get(ScheduledTriggerType.LOG).spread_window == timedelta(minutes=5)


@freeze_time(NOW)
def test_log_action_logs_each_run() -> None:
    runs = [
        TriggerContext(
            organization_id=1,
            trigger_type=ScheduledTriggerType.LOG,
            target_id=target_id,
            scheduled_for=NOW - timedelta(seconds=target_id),
        )
        for target_id in (3, 4)
    ]

    with patch("sentry.cadence.actions.logger") as logger:
        trigger_type_registry.get(ScheduledTriggerType.LOG).action(runs)

    assert logger.info.call_args_list == [
        call(
            "cadence.log_trigger.run",
            extra={
                "organization_id": 1,
                "target_id": target_id,
                "scheduled_for": (NOW - timedelta(seconds=target_id)).isoformat(),
                "lag_seconds": float(target_id),
            },
        )
        for target_id in (3, 4)
    ]
