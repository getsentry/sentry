from __future__ import annotations

from collections import defaultdict, namedtuple
from typing import Any, Dict, Sequence

from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphistory import record_group_history_from_activity_type
from sentry.models.groupsubscription import GroupSubscription
from sentry.models.project import Project
from sentry.models.user import User
from sentry.notifications.types import GroupSubscriptionReason
from sentry.signals import issue_ignored, issue_unignored, issue_unresolved
from sentry.tasks.integrations import kick_off_status_syncs
from sentry.types.activity import ActivityType
from sentry.utils import json

ActivityInfo = namedtuple("ActivityInfo", ("activity_type", "activity_data"))


def handle_status_update(
    group_list: Sequence[Group],
    projects: Sequence[Project],
    project_lookup: Dict[int, Project],
    new_status: int,
    new_substatus: int | None,
    is_bulk: bool,
    status_details: Dict[str, Any],
    acting_user: User | None,
    activity_type: str | None,
    sender: Any,
) -> ActivityInfo:
    """
    Update the status for a list of groups and create entries for Activity and GroupHistory.

    Returns a tuple of (activity_type, activity_data) for the activity that was created.
    """
    activity_data = {}
    if new_status == GroupStatus.UNRESOLVED:
        activity_type = ActivityType.SET_UNRESOLVED.value

        for group in group_list:
            if group.status == GroupStatus.IGNORED:
                issue_unignored.send_robust(
                    project=project_lookup[group.project_id],
                    user_id=acting_user.id if acting_user else None,
                    group=group,
                    transition_type="manual",
                    sender=sender,
                )
            else:
                issue_unresolved.send_robust(
                    project=project_lookup[group.project_id],
                    user=acting_user,
                    group=group,
                    transition_type="manual",
                    sender=sender,
                )
    elif new_status == GroupStatus.IGNORED:
        ignore_duration = (
            status_details.pop("ignoreDuration", None) or status_details.pop("snoozeDuration", None)
        ) or None
        activity_type = ActivityType.SET_IGNORED.value
        activity_data = {
            "ignoreCount": status_details.get("ignoreCount", None),
            "ignoreDuration": ignore_duration,
            "ignoreUntil": status_details.get("ignoreUntil", None),
            "ignoreUserCount": status_details.get("ignoreUserCount", None),
            "ignoreUserWindow": status_details.get("ignoreUserWindow", None),
            "ignoreWindow": status_details.get("ignoreWindow", None),
            "ignoreUntilEscalating": status_details.get("ignoreUntilEscalating", None),
        }
        if activity_data["ignoreUntil"] is not None:
            activity_data["ignoreUntil"] = json.datetime_to_str(activity_data["ignoreUntil"])

        groups_by_project_id = defaultdict(list)
        for group in group_list:
            groups_by_project_id[group.project_id].append(group)

        for project in projects:
            project_groups = groups_by_project_id.get(project.id)
            if project_groups:
                issue_ignored.send_robust(
                    project=project,
                    user=acting_user,
                    group_list=project_groups,
                    activity_data=activity_data,
                    sender=sender,
                )

    for group in group_list:
        group.status = new_status
        group.substatus = new_substatus

        activity = Activity.objects.create(
            project=project_lookup[group.project_id],
            group=group,
            type=activity_type,
            user_id=acting_user.id if acting_user else None,
            data=activity_data,
        )
        record_group_history_from_activity_type(group, activity_type, actor=acting_user)

        # TODO(dcramer): we need a solution for activity rollups
        # before sending notifications on bulk changes
        if not is_bulk:
            if acting_user:
                GroupSubscription.objects.subscribe(
                    subscriber=acting_user,
                    group=group,
                    reason=GroupSubscriptionReason.status_change,
                )
            activity.send_notification()

        if new_status == GroupStatus.UNRESOLVED:
            kick_off_status_syncs.apply_async(
                kwargs={"project_id": group.project_id, "group_id": group.id}
            )

    return ActivityInfo(activity_type, activity_data)
