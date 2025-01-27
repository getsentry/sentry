from __future__ import annotations

import logging
from collections.abc import Iterable
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, TypedDict

import jsonschema
import sentry_sdk
from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, JSONField, Model, region_silo_model
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.grouphistory import (
    GroupHistoryStatus,
    bulk_record_group_history,
    record_group_history,
)
from sentry.types.activity import ActivityType

if TYPE_CHECKING:
    from sentry.models.team import Team
    from sentry.users.models.user import User
    from sentry.users.services.user import RpcUser

INBOX_REASON_DETAILS = {
    "type": ["object", "null"],
    "properties": {
        "until": {"type": ["string", "null"], "format": "date-time"},
        "count": {"type": ["integer", "null"]},
        "window": {"type": ["integer", "null"]},
        "user_count": {"type": ["integer", "null"]},
        "user_window": {"type": ["integer", "null"]},
    },
    "required": [],
    "additionalProperties": False,
}


class GroupInboxReason(Enum):
    NEW = 0
    REGRESSION = 2
    MANUAL = 3
    REPROCESSED = 4
    ESCALATING = 5
    ONGOING = 6

    # DEPRECATED: Use ONGOING instead
    UNIGNORED = 1


class GroupInboxRemoveAction(Enum):
    RESOLVED = "resolved"
    IGNORED = "ignored"
    MARK_REVIEWED = "mark_reviewed"


@region_silo_model
class GroupInbox(Model):
    """
    A Group that is in the inbox.
    """

    __relocation_scope__ = RelocationScope.Excluded

    group = FlexibleForeignKey("sentry.Group", unique=True, db_constraint=False)
    project = FlexibleForeignKey("sentry.Project", null=True, db_constraint=False)
    organization = FlexibleForeignKey("sentry.Organization", null=True, db_constraint=False)
    reason = models.PositiveSmallIntegerField(null=False, default=GroupInboxReason.NEW.value)
    reason_details = JSONField(null=True)
    date_added = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupinbox"
        indexes = (models.Index(fields=("project", "date_added")),)


def add_group_to_inbox(
    group: Group,
    reason: GroupInboxReason,
    reason_details: InboxReasonDetails | None = None,
) -> GroupInbox:
    if reason_details is not None and reason_details["until"] is not None:
        reason_details["until"] = reason_details["until"].replace(microsecond=0)

    try:
        jsonschema.validate(reason_details, INBOX_REASON_DETAILS)
    except jsonschema.ValidationError:
        logging.exception("GroupInbox invalid jsonschema: %s", reason_details)
        reason_details = None

    group_inbox, _ = GroupInbox.objects.get_or_create(
        group=group,
        defaults={
            "project": group.project,
            "organization_id": group.project.organization_id,
            "reason": reason.value,
            "reason_details": reason_details,
        },
    )

    return group_inbox


def remove_group_from_inbox(
    group: Group,
    action: GroupInboxRemoveAction | None = None,
    user: User | RpcUser | None = None,
) -> None:
    try:
        group_inbox = GroupInbox.objects.get(group=group)
        group_inbox.delete()

        if action is GroupInboxRemoveAction.MARK_REVIEWED and user is not None:
            Activity.objects.create(
                project_id=group_inbox.group.project_id,
                group_id=group_inbox.group_id,
                type=ActivityType.MARK_REVIEWED.value,
                user_id=user.id,
            )
            record_group_history(group, GroupHistoryStatus.REVIEWED, actor=user)
    except GroupInbox.DoesNotExist:
        pass


def bulk_remove_groups_from_inbox(
    groups: BaseQuerySet[Group, Group],
    action: GroupInboxRemoveAction | None = None,
    user: User | RpcUser | Team | None = None,
) -> None:
    with sentry_sdk.start_span(name="bulk_remove_groups_from_inbox"):
        try:
            group_inbox = GroupInbox.objects.filter(group__in=groups)
            group_inbox.delete()

            if action is GroupInboxRemoveAction.MARK_REVIEWED and user is not None:
                Activity.objects.bulk_create(
                    [
                        Activity(
                            project_id=group_inbox_item.group.project_id,
                            group_id=group_inbox_item.group.id,
                            type=ActivityType.MARK_REVIEWED.value,
                            user_id=user.id,
                        )
                        for group_inbox_item in group_inbox
                    ]
                )

                bulk_record_group_history(list(groups), GroupHistoryStatus.REVIEWED, actor=user)
        except GroupInbox.DoesNotExist:
            pass


class InboxReasonDetails(TypedDict):
    until: datetime | None
    count: int | None
    window: int | None
    user_count: int | None
    user_window: int | None


class InboxDetails(TypedDict):
    reason: int
    reason_details: InboxReasonDetails | None
    date_added: datetime


def get_inbox_details(group_list: Iterable[Group]) -> dict[int, InboxDetails]:
    group_ids = [g.id for g in group_list]
    group_inboxes = GroupInbox.objects.filter(group__in=group_ids)
    return {
        gi.group_id: {
            "reason": gi.reason,
            "reason_details": gi.reason_details,
            "date_added": gi.date_added,
        }
        for gi in group_inboxes
    }
