from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from operator import attrgetter
from typing import Any, TypedDict

from django.db import router
from django.db.models.signals import post_save
from django.utils import timezone

from sentry.issues.escalating.forecasts import generate_and_save_forecasts
from sentry.models.group import Group, GroupStatus
from sentry.models.groupinbox import (
    GroupInboxRemoveAction,
    bulk_remove_groups_from_inbox,
    remove_group_from_inbox,
)
from sentry.models.groupsnooze import GroupSnooze
from sentry.models.project import Project
from sentry.signals import issue_archived
from sentry.snuba.referrer import Referrer
from sentry.types.group import GroupSubStatus
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.users.services.user.serial import serialize_generic_user
from sentry.users.services.user.service import user_service
from sentry.utils import metrics

logger = logging.getLogger(__name__)

IGNORED_CONDITION_FIELDS = {
    "ignoreDuration",
    "snoozeDuration",
    "ignoreCount",
    "ignoreWindow",
    "ignoreUserCount",
    "ignoreUserWindow",
}

SNOOZE_UPDATE_FIELDS = [
    "until",
    "count",
    "window",
    "user_count",
    "user_window",
    "state",
    "actor_id",
]


class IgnoredStatusDetails(TypedDict, total=False):
    ignoreCount: int | None
    ignoreUntil: datetime | None
    ignoreUserCount: int | None
    ignoreUserWindow: int | None
    ignoreWindow: int | None
    actor: User | None


@dataclass(frozen=True)
class PreparedIgnore:
    """An archive's unsaved snoozes and its response details."""

    has_condition: bool
    snoozes: list[GroupSnooze]
    status_details: IgnoredStatusDetails


def handle_archived_until_escalating(
    group_list: Sequence[Group],
    acting_user: RpcUser | User | None,
    projects: Sequence[Project],
    sender: Any,
) -> dict[str, bool]:
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


def _pop_condition(status_details: dict[str, Any], key: str) -> Any:
    value = status_details.pop(key, None)
    if not value:
        return None
    return value


def prepare_ignored(
    group_list: Sequence[Group],
    status_details: dict[str, Any],
    acting_user: RpcUser | User | None,
) -> PreparedIgnore:
    """Snoozes for archiving `group_list`; calls other services, so run before the transaction."""
    ignore_duration = _pop_condition(status_details, "ignoreDuration")
    if ignore_duration is None:
        ignore_duration = _pop_condition(status_details, "snoozeDuration")
    ignore_count = _pop_condition(status_details, "ignoreCount")
    ignore_window = _pop_condition(status_details, "ignoreWindow")
    ignore_user_count = _pop_condition(status_details, "ignoreUserCount")
    ignore_user_window = _pop_condition(status_details, "ignoreUserWindow")
    if not (ignore_duration or ignore_count or ignore_user_count):
        return PreparedIgnore(has_condition=False, snoozes=[], status_details={})

    if ignore_duration:
        ignore_until = timezone.now() + timedelta(minutes=ignore_duration)
    else:
        ignore_until = None
    if acting_user:
        actor_id = acting_user.id
    else:
        actor_id = None

    snoozes = []
    for group in group_list:
        state = {}
        if ignore_count and not ignore_window:
            state["times_seen"] = group.times_seen
        if ignore_user_count and not ignore_user_window:
            state["users_seen"] = group.count_users_seen(
                referrer=Referrer.TAGSTORE_GET_GROUPS_USER_COUNTS_IGNORED.value
            )
        snooze = GroupSnooze(
            group=group,
            until=ignore_until,
            count=ignore_count,
            window=ignore_window,
            user_count=ignore_user_count,
            user_window=ignore_user_window,
            state=state,
            actor_id=actor_id,
        )
        snoozes.append(snooze)

    serialized_user = None
    if acting_user:
        serialized_user = user_service.serialize_many(
            filter=dict(user_ids=[acting_user.id]),
            as_user=serialize_generic_user(acting_user),
        )
    if serialized_user:
        actor = serialized_user[0]
    else:
        actor = None
    new_status_details = IgnoredStatusDetails(
        ignoreCount=ignore_count,
        ignoreUntil=ignore_until,
        ignoreUserCount=ignore_user_count,
        ignoreUserWindow=ignore_user_window,
        ignoreWindow=ignore_window,
        actor=actor,
    )
    return PreparedIgnore(has_condition=True, snoozes=snoozes, status_details=new_status_details)


def handle_ignored(
    group_list: Sequence[Group],
    prepared: PreparedIgnore,
    acting_user: RpcUser | User | None,
) -> IgnoredStatusDetails:
    """The archive's database writes for snoozes built by `prepare_ignored`."""
    metrics.incr("group.ignored", skip_internal=True)
    group_ids = [group.id for group in group_list]
    groups = Group.objects.filter(id__in=group_ids)
    bulk_remove_groups_from_inbox(groups, action=GroupInboxRemoveAction.IGNORED, user=acting_user)

    if not prepared.has_condition:
        GroupSnooze.objects.filter(group__in=group_list).delete()
        return prepared.status_details

    # Same row order in every request, so concurrent archives of the same issues can't deadlock.
    snoozes = sorted(prepared.snoozes, key=attrgetter("group_id"))
    GroupSnooze.objects.bulk_create(
        snoozes,
        update_conflicts=True,
        unique_fields=["group"],
        update_fields=SNOOZE_UPDATE_FIELDS,
    )
    # bulk_create skips post_save, which refreshes the caches post_process and get_status read.
    database = router.db_for_write(GroupSnooze)
    for snooze in snoozes:
        post_save.send(
            sender=GroupSnooze,
            instance=snooze,
            created=False,
            update_fields=None,
            raw=False,
            using=database,
        )

    groups.filter(status=GroupStatus.UNRESOLVED).update(
        substatus=GroupSubStatus.UNTIL_CONDITION_MET, status=GroupStatus.IGNORED
    )
    return prepared.status_details
