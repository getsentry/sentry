from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Mapping, Sequence
from datetime import datetime, timedelta, timezone
from typing import Any

from django.db.models.signals import post_save

from sentry import options
from sentry.integrations.tasks.kick_off_status_syncs import kick_off_status_syncs
from sentry.issues.ignored import IGNORED_CONDITION_FIELDS
from sentry.issues.ongoing import TRANSITION_AFTER_DAYS
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphistory import record_group_history_from_activity_type
from sentry.models.groupsubscription import GroupSubscription
from sentry.models.project import Project
from sentry.notifications.types import GroupSubscriptionReason
from sentry.signals import issue_ignored, issue_unignored, issue_unresolved
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils import json

logger = logging.getLogger(__name__)


def infer_substatus(
    new_status: int | None,
    new_substatus: int | None,
    status_details: Mapping[str, Any],
    group_list: Sequence[Group],
) -> int | None:
    if new_substatus is not None:
        return new_substatus

    if new_status == GroupStatus.IGNORED:
        if status_details.get("untilEscalating"):
            return GroupSubStatus.UNTIL_ESCALATING

        if any(status_details.get(key) is not None for key in IGNORED_CONDITION_FIELDS):
            return GroupSubStatus.UNTIL_CONDITION_MET

        return GroupSubStatus.FOREVER

    if new_status == GroupStatus.UNRESOLVED:
        new_substatus = GroupSubStatus.ONGOING

        # Set the group substatus back to NEW if it was unignored withing 7 days of when it was first seen
        if len(group_list) == 1:
            if group_list[0].status == GroupStatus.IGNORED:
                is_new_group = group_list[0].first_seen > datetime.now(timezone.utc) - timedelta(
                    days=TRANSITION_AFTER_DAYS
                )
                return GroupSubStatus.NEW if is_new_group else GroupSubStatus.ONGOING
            if group_list[0].status == GroupStatus.RESOLVED:
                return GroupSubStatus.REGRESSED

            return GroupSubStatus.ONGOING

    return new_substatus


def handle_status_update(
    group_list: Sequence[Group],
    projects: Sequence[Project],
    project_lookup: Mapping[int, Project],
    new_status: int,
    new_substatus: int | None,
    is_bulk: bool,
    status_details: dict[str, Any],
    acting_user: RpcUser | User | None,
    sender: Any,
) -> None:
    """
    Update the status for a list of groups and create entries for Activity and GroupHistory.
    This currently handles unresolving or ignoring groups.
    """
    activity_data = {}
    activity_type = (
        ActivityType.SET_IGNORED.value
        if new_status == GroupStatus.IGNORED
        else ActivityType.SET_UNRESOLVED.value
    )
    if new_status == GroupStatus.UNRESOLVED:
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

        if not options.get("groups.enable-post-update-signal"):
            post_save.send(
                sender=Group,
                instance=group,
                created=False,
                update_fields=["status", "substatus"],
            )
