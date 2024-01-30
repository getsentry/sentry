from __future__ import annotations

import logging
from enum import Enum, IntEnum
from typing import TYPE_CHECKING, Type

from sentry import features
from sentry.issues.grouptype import (
    GroupCategory,
    GroupType,
    PerformanceP95EndpointRegressionGroupType,
    ProfileFunctionRegressionType,
)
from sentry.models.activity import Activity
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus, record_group_history
from sentry.models.user import User
from sentry.services.hybrid_cloud.user.model import RpcUser
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


def get_priority_for_escalating_group(group: Group) -> PriorityLevel:
    """
    Get the priority for a group that is escalating by incrementing it one level.
    """
    if group.priority and group.priority == PriorityLevel.LOW:
        return PriorityLevel.MEDIUM

    return PriorityLevel.HIGH


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

    initial_priority = (
        group.data.get("metadata", {}).get("initial_priority")
        if not previous_priority_history
        else None
    )

    new_priority = (
        [
            priority
            for priority, status in PRIORITY_TO_GROUP_HISTORY_STATUS.items()
            if status == previous_priority_history.status
        ][0]
        if previous_priority_history
        else initial_priority
    )

    if not new_priority:
        logger.error(
            "Unable to determine previous priority value for group %s after transitioning to ongoing",
            group.id,
        )
        return None

    return new_priority


def auto_update_priority(group: Group, reason: PriorityChangeReason) -> None:
    """
    Update the priority of a group due to state changes.
    """
    if not features.has("projects:issue-priority", group.project, actor=None):
        return None

    new_priority = None
    if reason == PriorityChangeReason.ESCALATING:
        new_priority = get_priority_for_escalating_group(group)
    elif reason == PriorityChangeReason.ONGOING:
        new_priority = get_priority_for_ongoing_group(group)

    if new_priority is not None:
        update_priority(group, new_priority, reason)


def get_default_priority_for_group_type(group_type: Type[GroupType], level: str) -> PriorityLevel:
    if group_type.category in [GroupCategory.REPLAY.value, GroupCategory.FEEDBACK.value]:
        return PriorityLevel.MEDIUM

    if group_type.category == GroupCategory.CRON.value:
        if level == "warning":
            return PriorityLevel.MEDIUM

        return PriorityLevel.HIGH

    # Profiling issues should be treated the same as Performance issues since they are merging
    if group_type.category in [GroupCategory.PERFORMANCE.value, GroupCategory.PROFILE.value]:
        # Statistical detectors are medium priority
        if group_type.id in [
            ProfileFunctionRegressionType.type_id,
            PerformanceP95EndpointRegressionGroupType.type_id,
        ]:
            return PriorityLevel.MEDIUM
        return PriorityLevel.LOW

    # All other issues are the default medium priority
    return PriorityLevel.MEDIUM
