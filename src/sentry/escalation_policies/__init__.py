from datetime import UTC, datetime

from sentry.escalation_policies.logic import coalesce_schedule_layers
from sentry.escalation_policies.models.rotation_schedule import RotationSchedule


# Take a rotation schedule and a time and return the user ID for the oncall user
def determine_schedule_oncall(
    schedule: RotationSchedule, time: datetime | None = None
) -> int | None:
    if time is None:
        time = datetime.now(UTC)
    rotation_periods = coalesce_schedule_layers(schedule.layers.all(), time, time)

    if len(rotation_periods) == 0:
        return None

    return rotation_periods[0]["user_id"]
