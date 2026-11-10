from datetime import UTC, datetime, timedelta
from unittest.mock import call, patch

from sentry.cadence.models import ScheduledTriggerType
from sentry.cadence.registry import TriggerFiring, trigger_type_registry
from sentry.testutils.helpers.datetime import freeze_time

NOW = datetime(2024, 3, 9, 12, 0, tzinfo=UTC)


@freeze_time(NOW)
def test_log_action_logs_each_firing() -> None:
    firings = [
        TriggerFiring(
            organization_id=1,
            trigger_type=ScheduledTriggerType.LOG,
            target_id=target_id,
            scheduled_for=NOW - timedelta(seconds=target_id),
            fire_at=NOW - timedelta(seconds=2),
        )
        for target_id in (3, 4)
    ]

    with patch("sentry.cadence.actions.logger") as logger:
        trigger_type_registry.get(ScheduledTriggerType.LOG).action(firings)

    assert logger.info.call_args_list == [
        call(
            "cadence.log_trigger.fired",
            extra={
                "organization_id": 1,
                "target_id": target_id,
                "scheduled_for": (NOW - timedelta(seconds=target_id)).isoformat(),
                "fire_at": (NOW - timedelta(seconds=2)).isoformat(),
                "fired_at": NOW.isoformat(),
                "seconds_since_scheduled": float(target_id),
                "seconds_since_due": 2.0,
            },
        )
        for target_id in (3, 4)
    ]


@freeze_time(NOW)
def test_log_action_accepts_firings_without_due_time() -> None:
    firing = TriggerFiring(
        organization_id=1,
        trigger_type=ScheduledTriggerType.LOG,
        target_id=1,
        scheduled_for=NOW,
    )

    with patch("sentry.cadence.actions.logger") as logger:
        trigger_type_registry.get(ScheduledTriggerType.LOG).action([firing])

    assert logger.info.call_args.kwargs["extra"]["fire_at"] is None
    assert logger.info.call_args.kwargs["extra"]["seconds_since_due"] is None
