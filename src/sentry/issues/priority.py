from __future__ import annotations

import logging
from enum import Enum, IntEnum

from sentry import features
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.grouphistory import GroupHistoryStatus, record_group_history
from sentry.models.user import User
from sentry.services.hybrid_cloud.user.model import RpcUser
from sentry.types.activity import ActivityType


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
    actor: User | RpcUser | None = None,
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
        user=actor,
        data={
            "priority": PRIORITY_LEVEL_TO_STR[priority],
            "reason": reason,
        },
    )
    record_group_history(group, status=PRIORITY_TO_GROUP_HISTORY_STATUS[priority], actor=actor)


def get_priority_for_escalating_group(group: Group) -> PriorityLevel | None:
    """
    Get the priority for a group that is escalating by incrementing it one level.
    """

    if not group.priority or group.priority == PriorityLevel.HIGH:
        # HIGH priority issues can not be incremented further
        return PriorityLevel.HIGH
    elif group.priority == PriorityLevel.MEDIUM:
        return PriorityLevel.HIGH
    elif group.priority == PriorityLevel.LOW:
        return PriorityLevel.MEDIUM

    # This should never happen
    logger.error(
        "Unable to determine escalation priority for group %s with priority %s",
        group.id,
        group.priority,
    )
    return None


def auto_update_priority(group: Group, reason: PriorityChangeReason) -> None:
    """
    Update the priority of a group due to state changes.
    """
    if not features.has("projects:issue-priority", group.project, actor=None):
        return

    if reason == PriorityChangeReason.ESCALATING:
        new_priority = get_priority_for_escalating_group(group)
        if not new_priority:
            return

        update_priority(group, new_priority, reason)
