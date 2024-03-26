from __future__ import annotations

import logging
from enum import Enum
from typing import TYPE_CHECKING

from sentry import features
from sentry.models.activity import Activity
from sentry.models.actor import get_actor_id_for_user
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus, record_group_history
from sentry.models.project import Project
from sentry.models.user import User
from sentry.services.hybrid_cloud.user.model import RpcUser
from sentry.signals import issue_update_priority
from sentry.types.activity import ActivityType
from sentry.types.group import PriorityLevel

if TYPE_CHECKING:
    from sentry.models.group import Group


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
        user_id=get_actor_id_for_user(actor) if actor else None,
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
    if not features.has("projects:issue-priority", group.project, actor=None):
        return None

    previous_priority_history = (
        GroupHistory.objects.filter(
            group_id=group.id, status__in=PRIORITY_TO_GROUP_HISTORY_STATUS.values()
        )
        .order_by("-date_added")
        .first()
    )

    new_priority = (
        [
            priority
            for priority, status in PRIORITY_TO_GROUP_HISTORY_STATUS.items()
            if status == previous_priority_history.status
        ][0]
        if previous_priority_history
        else get_initial_priority(group)
    )

    if not new_priority:
        logger.error(
            "Unable to determine previous priority value after transitioning group to ongoing",
            extra={"group": group.id},
        )
        return None

    return PriorityLevel(new_priority)


def auto_update_priority(group: Group, reason: PriorityChangeReason) -> None:
    """
    Update the priority of a group due to state changes.
    """
    if (
        not features.has("projects:issue-priority", group.project, actor=None)
        or group.priority_locked_at is not None
    ):
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
