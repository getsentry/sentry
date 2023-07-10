from __future__ import annotations

from typing import Any, Dict, List

from sentry import features
from sentry.issues.ongoing import bulk_transition_group_to_ongoing
from sentry.models import Group, GroupStatus, Project, User
from sentry.models.groupinbox import (
    GroupInboxReason,
    GroupInboxRemoveAction,
    add_group_to_inbox,
    remove_group_from_inbox,
)
from sentry.signals import issue_mark_reviewed
from sentry.types.group import GroupSubStatus


def update_inbox(
    in_inbox: bool,
    group_list: List[Group],
    project_lookup: Dict[int, Project],
    acting_user: User | None,
    http_referrer: str,
    sender: Any,
) -> bool:
    """
    Support moving groups in or out of the inbox via the Mark Reviewed button.

    Returns a boolean indicating whether or not the groups are now in the inbox.
    """
    if not group_list:
        return in_inbox

    if in_inbox:
        for group in group_list:
            add_group_to_inbox(group, GroupInboxReason.MANUAL)
    elif not in_inbox:
        has_escalating = features.has(
            "organizations:escalating-issues", group_list[0].project.organization, actor=acting_user
        )
        for group in group_list:
            # Remove from inbox first to insert the mark reviewed activity
            remove_group_from_inbox(
                group,
                action=GroupInboxRemoveAction.MARK_REVIEWED,
                user=acting_user,
                referrer=http_referrer,
            )
            if (
                has_escalating
                and group.substatus != GroupSubStatus.ONGOING
                and group.status == GroupStatus.UNRESOLVED
            ):
                bulk_transition_group_to_ongoing(
                    group.status,
                    group.substatus,
                    [group],
                    activity_data={"manually": True},
                )

            issue_mark_reviewed.send_robust(
                project=project_lookup[group.project_id],
                user=acting_user,
                group=group,
                sender=sender,
            )
    return in_inbox
