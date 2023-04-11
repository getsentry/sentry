from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, Optional, Sequence

from sentry.models import (
    Activity,
    Group,
    GroupStatus,
    GroupSubscription,
    Project,
    User,
    record_group_history_from_activity_type,
)
from sentry.notifications.types import GroupSubscriptionReason
from sentry.signals import issue_ignored, issue_unignored, issue_unresolved
from sentry.tasks.integrations import kick_off_status_syncs
from sentry.types.activity import ActivityType


def handle_status_update(
    group_list=Sequence[Group],
    projects=Sequence[Project],
    project_lookup=Dict[int, Project],
    acting_user=Optional[User],
    new_status=GroupStatus,
    is_bulk=bool,
    status_details=Dict[str, Any],
    sender=Any,
):
    activity_type = None
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
            "ignoreCount": status_details.get("ignoreCount"),
            "ignoreDuration": ignore_duration,
            "ignoreUntil": status_details.get("ignoreUntil"),
            "ignoreUserCount": status_details.get("ignoreUserCount"),
            "ignoreUserWindow": status_details.get("ignoreUserWindow"),
            "ignoreWindow": status_details.get("ignoreWindow"),
        }

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

        activity = Activity.objects.create(
            project=project_lookup[group.project_id],
            group=group,
            type=activity_type,
            user_id=acting_user.id,
            data=activity_data,
        )
        record_group_history_from_activity_type(group, activity_type, actor=acting_user)

        # TODO(dcramer): we need a solution for activity rollups
        # before sending notifications on bulk changes
        if not is_bulk:
            if acting_user:
                GroupSubscription.objects.subscribe(
                    user=acting_user,
                    group=group,
                    reason=GroupSubscriptionReason.status_change,
                )
            activity.send_notification()

        if new_status == GroupStatus.UNRESOLVED:
            kick_off_status_syncs.apply_async(
                kwargs={"project_id": group.project_id, "group_id": group.id}
            )

    return activity_type, activity_data
