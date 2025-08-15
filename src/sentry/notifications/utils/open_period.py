from datetime import datetime

from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.groupopenperiod import get_latest_open_period
from sentry.types.activity import ActivityType


def open_period_start_for_group(group: Group) -> datetime | None:
    """
    Get the start of the open period for a group.
    This is the last activity of the group that is not a resolution or the first_seen of the group.
    We need to check the first seen since we don't create an activity when the group is created.
    """

    latest_open_period = get_latest_open_period(group)
    if latest_open_period:
        return latest_open_period.date_started

    # Fallback to the last activity of the group
    # Get the last activity of the group
    latest_unresolved_activity: Activity | None = (
        Activity.objects.filter(
            group=group,
            type=ActivityType.SET_REGRESSION.value,
        )
        .order_by("-datetime")
        .first()
    )

    if latest_unresolved_activity:
        return latest_unresolved_activity.datetime

    return group.first_seen
