from datetime import UTC, datetime, timedelta
from unittest.mock import call, patch

from sentry.cadence.models import ScheduledTriggerType
from sentry.cadence.registry import TriggerContext, trigger_action_registry
from sentry.testutils.helpers.datetime import freeze_time

NOW = datetime(2024, 3, 9, 12, 0, tzinfo=UTC)


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
        trigger_action_registry.get(ScheduledTriggerType.LOG)(runs)

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
