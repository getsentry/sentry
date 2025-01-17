from datetime import datetime

from sentry.models.activity import Activity, ActivityType
from sentry.models.group import Group


def open_period_start_for_group(group: Group) -> datetime | None:
    """
    Get the start of the open period for a group.
    This is the last activity of the group that is not a resolution or the first_seen of the group.
    We need to check the first seen since we don't create an activity when the group is created.
    """

    # Get the last activity of the group
    latest_unresolved_activity: Activity | None = (
        Activity.objects.filter(
            group=group,
            type=ActivityType.SET_UNRESOLVED.value,
        )
        .order_by("-datetime")
        .first()
    )

    if latest_unresolved_activity:
        return latest_unresolved_activity.datetime

    return group.first_seen
