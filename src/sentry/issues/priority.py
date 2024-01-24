from __future__ import annotations

import logging
from enum import Enum, IntEnum
from typing import TYPE_CHECKING

from sentry import features
from sentry.models.activity import Activity
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus, record_group_history
from sentry.types.activity import ActivityType

if TYPE_CHECKING:
    from sentry.models.group import Group


class PriorityLevel(IntEnum):
    LOW = 25
    MEDIUM = 50
    HIGH = 75


PRIORITY_LEVEL_TO_STR: dict[int, str] = {
    PriorityLevel.LOW: "low",
    PriorityLevel.MEDIUM: "medium",
    PriorityLevel.HIGH: "high",
}


class PriorityChangeReason(Enum):
    ESCALATING = "escalating"
    ONGOING = "ongoing"


PRIORITY_TO_GROUP_HISTORY_STATUS = {
    PriorityLevel.HIGH: GroupHistoryStatus.PRIORITY_HIGH,
    PriorityLevel.MEDIUM: GroupHistoryStatus.PRIORITY_MEDIUM,
    PriorityLevel.LOW: GroupHistoryStatus.PRIORITY_LOW,
}

logger = logging.getLogger(__name__)


def update_priority(
    group: Group,
    priority: PriorityLevel,
    reason: PriorityChangeReason | None = None,
) -> None:
    """
    Update the priority of a group and record the change in the activity and group history.
    """
    if group.priority_locked_at is not None:
        return

    group.update(priority=priority)
    Activity.objects.create_group_activity(
        group=group,
        type=ActivityType.SET_PRIORITY,
        data={
            "priority": PRIORITY_LEVEL_TO_STR[priority],
            "reason": reason,
        },
    )
    record_group_history(group, PRIORITY_TO_GROUP_HISTORY_STATUS[priority])


def get_priority_for_escalating_group(group: Group) -> PriorityLevel | None:
    """
    Get the priority for a group that is escalating.
    """
    if not group.priority or group.priority == PriorityLevel.HIGH:
        return PriorityLevel.HIGH
    elif group.priority == PriorityLevel.LOW:
        return PriorityLevel.MEDIUM
    elif group.priority == PriorityLevel.MEDIUM:
        return PriorityLevel.HIGH

    logger.error(
        "Unable to determine escalation priority for group %s with priority %s",
        group.id,
        group.priority,
    )
    return


def get_priority_for_ongoing_group(group: Group) -> PriorityLevel | None:
    if not features.has("projects:issue-priority", group.project, actor=None):
        return

    previous_priority_history = (
        GroupHistory.objects.filter(
            group_id=group.id, status__in=PRIORITY_TO_GROUP_HISTORY_STATUS.values()
        )
        .order_by("-date_added")
        .first()
    )

    if previous_priority_history is None:
        logger.error("No previous priority history for group %s", group.id)
        return

    new_priority = [
        priority
        for priority, status in PRIORITY_TO_GROUP_HISTORY_STATUS.items()
        if status == previous_priority_history.status
    ]
    if len(new_priority) != 1:
        logger.error(
            "Unable to determine priority for group %s with status %s",
            group.id,
            previous_priority_history.status,
        )
        return

    return new_priority[0]


def auto_update_priority(group: Group, reason: PriorityChangeReason) -> None:
    """
    Update the priority of a group due to state changes.
    """
    if not features.has("projects:issue-priority", group.project, actor=None):
        return

    new_priority = None
    if reason == PriorityChangeReason.ESCALATING:
        new_priority = get_priority_for_escalating_group(group)
    elif reason == PriorityChangeReason.ONGOING:
        new_priority = get_priority_for_ongoing_group(group)

    if new_priority is not None:
        update_priority(group, new_priority, reason)
