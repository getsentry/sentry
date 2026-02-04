from __future__ import annotations

import logging
from enum import StrEnum
from typing import TYPE_CHECKING

from sentry.models.activity import Activity
from sentry.models.grouphistory import GroupHistoryStatus, record_group_history
from sentry.models.project import Project
from sentry.signals import issue_update_priority
from sentry.types.activity import ActivityType
from sentry.types.group import PriorityLevel
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.models.group import Group

logger = logging.getLogger(__name__)


class PriorityChangeReason(StrEnum):
    ESCALATING = "escalating"
    ONGOING = "ongoing"
    ISSUE_PLATFORM = "issue_platform"


PRIORITY_TO_GROUP_HISTORY_STATUS = {
    PriorityLevel.HIGH: GroupHistoryStatus.PRIORITY_HIGH,
    PriorityLevel.MEDIUM: GroupHistoryStatus.PRIORITY_MEDIUM,
    PriorityLevel.LOW: GroupHistoryStatus.PRIORITY_LOW,
}


def update_priority(
    group: Group,
    priority: PriorityLevel | None,
    sender: str,
    reason: PriorityChangeReason | None = None,
    actor: User | RpcUser | None = None,
    project: Project | None = None,
    is_regression: bool = False,
    event_id: str | None = None,
) -> None:
    """
    Update the priority of a group and record the change in the activity and group history.
    """
    from sentry.models.groupopenperiod import get_latest_open_period, should_create_open_periods
    from sentry.models.groupopenperiodactivity import (
        GroupOpenPeriodActivity,
        OpenPeriodActivityType,
    )

    if priority is None or group.priority == priority:
        return

    previous_priority = PriorityLevel(group.priority) if group.priority is not None else None
    group.update(priority=priority)
    Activity.objects.create_group_activity(
        group=group,
        type=ActivityType.SET_PRIORITY,
        user=actor,
        data={
            "priority": priority.to_str(),
            "reason": reason,
        },
    )

    record_group_history(group, status=PRIORITY_TO_GROUP_HISTORY_STATUS[priority], actor=actor)

    issue_update_priority.send_robust(
        group=group,
        project=project,
        new_priority=priority.to_str(),
        previous_priority=previous_priority.to_str() if previous_priority else None,
        user_id=actor.id if actor else None,
        reason=reason.value if reason else None,
        sender=sender,
    )

    # create a row in the GroupOpenPeriodActivity table
    open_period = get_latest_open_period(group)
    if open_period is None:
        if should_create_open_periods(group.type):
            metrics.incr("issues.priority.no_open_period_found")
            logger.error("No open period found for group", extra={"group_id": group.id})
        return

    if is_regression:
        try:
            activity_entry_to_update = GroupOpenPeriodActivity.objects.get(
                group_open_period=open_period, type=OpenPeriodActivityType.OPENED
            )
            activity_entry_to_update.update(value=priority)
        except GroupOpenPeriodActivity.DoesNotExist:
            # in case the rollout somehow goes out between open period creation and priority update
            metrics.incr("issues.priority.open_period_activity_race_condition")
            GroupOpenPeriodActivity.objects.create(
                date_added=open_period.date_started,
                group_open_period=open_period,
                type=OpenPeriodActivityType.OPENED,
                value=priority,
                event_id=event_id,
            )
    else:
        # make a new activity entry
        GroupOpenPeriodActivity.objects.create(
            group_open_period=open_period,
            type=OpenPeriodActivityType.STATUS_CHANGE,
            value=priority,
            event_id=event_id,
        )


def get_priority_for_escalating_group(group: Group) -> PriorityLevel:
    """
    Get the priority for a group that is escalating by incrementing it one level.
    """
    if group.priority and group.priority == PriorityLevel.LOW:
        return PriorityLevel.MEDIUM

    return PriorityLevel.HIGH


def get_initial_priority(group: Group) -> PriorityLevel | None:
    initial_priority = group.data.get("metadata", {}).get(
        "initial_priority", None
    ) or group.data.get("initial_priority", None)
    return PriorityLevel(initial_priority) if initial_priority else None


def get_priority_for_ongoing_group(group: Group) -> PriorityLevel | None:
    # Fall back to the initial priority
    new_priority = get_initial_priority(group)
    if not new_priority:
        logger.error(
            "get_priority_for_ongoing_group.initial_priority_not_found",
            extra={"group": group.id},
        )
        return None

    return new_priority


def auto_update_priority(group: Group, reason: PriorityChangeReason) -> None:
    """
    Update the priority of a group due to state changes.
    """
    if group.priority_locked_at is not None:
        return None

    new_priority = None
    if reason == PriorityChangeReason.ESCALATING:
        new_priority = get_priority_for_escalating_group(group)
    elif reason == PriorityChangeReason.ONGOING:
        new_priority = get_priority_for_ongoing_group(group)

    if new_priority is not None and new_priority != group.priority:
        update_priority(
            group=group,
            priority=new_priority,
            sender="auto_update_priority",
            reason=reason,
            actor=None,
            project=group.project,
        )
