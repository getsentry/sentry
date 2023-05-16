from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, Sequence, TypedDict

from django.utils import timezone

from sentry.issues.forecasts import generate_and_save_forecasts
from sentry.models import (
    Group,
    GroupInboxRemoveAction,
    GroupSnooze,
    Project,
    User,
    remove_group_from_inbox,
)
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.signals import issue_archived
from sentry.utils import metrics

logger = logging.getLogger(__name__)


class IgnoredStatusDetails(TypedDict, total=False):
    ignoreCount: int | None
    ignoreUntil: datetime | None
    ignoreUserCount: int | None
    ignoreUserWindow: int | None
    ignoreWindow: int | None
    actor: User | None


def handle_archived_until_escalating(
    group_list: Sequence[Group],
    acting_user: User | None,
    projects: Sequence[Project],
    sender: Any,
) -> Dict[str, bool]:
    """
    Handle issues that are archived until escalating and create a forecast for them.

    Issues that are marked as ignored with `archiveDuration: until_escalating`
    in the statusDetail are treated as `archived_until_escalating`.
    """
    metrics.incr("group.archived_until_escalating", skip_internal=True)
    for group in group_list:
        remove_group_from_inbox(group, action=GroupInboxRemoveAction.IGNORED, user=acting_user)
    generate_and_save_forecasts(group_list)
    logger.info(
        "archived_until_escalating.forecast_created",
        extra={
            "detail": "Created forecast for groups",
            "group_ids": [group.id for group in group_list],
        },
    )

    groups_by_project_id = defaultdict(list)
    for group in group_list:
        groups_by_project_id[group.project_id].append(group)

    for project in projects:
        project_groups = groups_by_project_id.get(project.id)
        issue_archived.send_robust(
            project=project,
            user=acting_user,
            group_list=project_groups,
            activity_data={"until_escalating": True},
            sender=sender,
        )

    return {"ignoreUntilEscalating": True}


def handle_ignored(
    group_ids: Sequence[Group],
    group_list: Sequence[Group],
    status_details: Dict[str, Any],
    acting_user: User | None,
    user: User,
) -> IgnoredStatusDetails:
    """
    Handle issues that are ignored and create a snooze for them.

    Evaluate ignored issues according to the statusDetails and create a snooze as needed.

    Returns: a dict with the statusDetails for ignore conditions.
    """
    metrics.incr("group.ignored", skip_internal=True)
    for group in group_ids:
        remove_group_from_inbox(group, action=GroupInboxRemoveAction.IGNORED, user=acting_user)

    new_status_details: IgnoredStatusDetails = {}
    ignore_duration = (
        status_details.pop("ignoreDuration", None) or status_details.pop("snoozeDuration", None)
    ) or None
    ignore_count = status_details.pop("ignoreCount", None) or None
    ignore_window = status_details.pop("ignoreWindow", None) or None
    ignore_user_count = status_details.pop("ignoreUserCount", None) or None
    ignore_user_window = status_details.pop("ignoreUserWindow", None) or None
    if ignore_duration or ignore_count or ignore_user_count:
        if ignore_duration:
            ignore_until = timezone.now() + timedelta(minutes=ignore_duration)
        else:
            ignore_until = None
        for group in group_list:
            state = {}
            if ignore_count and not ignore_window:
                state["times_seen"] = group.times_seen
            if ignore_user_count and not ignore_user_window:
                state["users_seen"] = group.count_users_seen()
            GroupSnooze.objects.create_or_update(
                group=group,
                values={
                    "until": ignore_until,
                    "count": ignore_count,
                    "window": ignore_window,
                    "user_count": ignore_user_count,
                    "user_window": ignore_user_window,
                    "state": state,
                    "actor_id": user.id if user.is_authenticated else None,
                },
            )
            serialized_user = user_service.serialize_many(
                filter=dict(user_ids=[user.id]), as_user=user
            )
            new_status_details = IgnoredStatusDetails(
                ignoreCount=ignore_count,
                ignoreUntil=ignore_until,
                ignoreUserCount=ignore_user_count,
                ignoreUserWindow=ignore_user_window,
                ignoreWindow=ignore_window,
                actor=serialized_user[0] if serialized_user else None,
            )
    else:
        GroupSnooze.objects.filter(group__in=group_ids).delete()
        ignore_until = None

    return new_status_details
