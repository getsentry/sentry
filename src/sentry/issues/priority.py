from __future__ import annotations

import logging
from enum import Enum
from typing import TYPE_CHECKING

from sentry.models.activity import Activity
from sentry.models.grouphistory import GroupHistoryStatus, record_group_history
from sentry.models.project import Project
from sentry.signals import issue_update_priority
from sentry.types.activity import ActivityType
from sentry.types.group import PriorityLevel
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser

if TYPE_CHECKING:
    from sentry.models.group import Group

logger = logging.getLogger(__name__)


class PriorityChangeReason(Enum):
    ESCALATING = "escalating"
    ONGOING = "ongoing"


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
) -> None:
    """
    Update the priority of a group and record the change in the activity and group history.
    """

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
