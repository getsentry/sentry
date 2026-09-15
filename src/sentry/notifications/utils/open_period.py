from datetime import datetime

from django.db.models import Q

from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.groupopenperiod import GroupOpenPeriod, get_latest_open_period
from sentry.models.groupopenperiodactivity import GroupOpenPeriodActivity
from sentry.services.eventstore.models import GroupEvent
from sentry.types.activity import ActivityType


def get_open_period_for_event(group: Group, event: GroupEvent | Activity) -> GroupOpenPeriod | None:
    """Find the period that produced an event, not the latest period at delivery time."""
    open_period = None
    if isinstance(event, Activity) and event.id is not None:
        open_period = GroupOpenPeriod.objects.filter(
            group=group, resolution_activity_id=event.id
        ).first()
    elif isinstance(event, GroupEvent):
        period_activity = (
            GroupOpenPeriodActivity.objects.filter(
                group_open_period__group=group, event_id=event.event_id
            )
            .select_related("group_open_period")
            .first()
        )
        open_period = period_activity.group_open_period if period_activity else None

    if open_period is not None:
        return open_period

    # Historical periods and events without a recorded transition may lack an
    # explicit association. Only use a period containing the original timestamp;
    # falling back to the latest period would silently attach to a later incident.
    return (
        GroupOpenPeriod.objects.filter(group=group, date_started__lte=event.datetime)
        .filter(Q(date_ended__isnull=True) | Q(date_ended__gte=event.datetime))
        .order_by("-date_started")
        .first()
    )


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
