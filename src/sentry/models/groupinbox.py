import logging
from enum import Enum
from typing import Optional

import jsonschema
from django.db import models
from django.utils import timezone

from sentry import features
from sentry.db.models import FlexibleForeignKey, JSONField, Model, region_silo_only_model
from sentry.models import Activity
from sentry.models.grouphistory import GroupHistoryStatus, record_group_history
from sentry.signals import inbox_in, inbox_out
from sentry.types.activity import ActivityType

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


@region_silo_only_model
class GroupInbox(Model):
    """
    A Group that is in the inbox.
    """

    __include_in_export__ = False

    group = FlexibleForeignKey("sentry.Group", unique=True, db_constraint=False)
    project = FlexibleForeignKey("sentry.Project", null=True, db_constraint=False)
    organization = FlexibleForeignKey("sentry.Organization", null=True, db_constraint=False)
    reason = models.PositiveSmallIntegerField(null=False, default=GroupInboxReason.NEW.value)
    reason_details = JSONField(null=True)
    date_added = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupinbox"
        index_together = (("project", "date_added"),)


def add_group_to_inbox(group, reason, reason_details=None):
    if reason_details is not None:
        if "until" in reason_details and reason_details["until"] is not None:
            reason_details["until"] = reason_details["until"].replace(microsecond=0).isoformat()

    try:
        jsonschema.validate(reason_details, INBOX_REASON_DETAILS)
    except jsonschema.ValidationError:
        logging.error(f"GroupInbox invalid jsonschema: {reason_details}")
        reason_details = None

    group_inbox, created = GroupInbox.objects.get_or_create(
        group=group,
        defaults={
            "project": group.project,
            "organization_id": group.project.organization_id,
            "reason": reason.value,
            "reason_details": reason_details,
        },
    )

    if reason is not GroupInboxReason.NEW:
        # Ignore new issues, too many events
        inbox_in.send_robust(
            project=group.project,
            user=None,
            group=group,
            sender="add_group_to_inbox",
            reason=reason.name.lower(),
        )
    return group_inbox


def remove_group_from_inbox(group, action=None, user=None, referrer=None):
    # The MARK_REVIEWED feature is going away as part of the issue states project
    if action == GroupInboxRemoveAction.MARK_REVIEWED and features.has(
        "organizations:remove-mark-reviewed", group.project.organization
    ):
        return

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

        if action:
            inbox_out.send_robust(
                group=group_inbox.group,
                project=group_inbox.group.project,
                user=user,
                sender="remove_group_from_inbox",
                action=action.value,
                inbox_date_added=group_inbox.date_added,
                referrer=referrer,
            )
    except GroupInbox.DoesNotExist:
        pass


def get_inbox_details(group_list):
    group_ids = [g.id for g in group_list]
    group_inboxes = GroupInbox.objects.filter(group__in=group_ids)
    inbox_stats = {
        gi.group_id: {
            "reason": gi.reason,
            "reason_details": gi.reason_details,
            "date_added": gi.date_added,
        }
        for gi in group_inboxes
    }

    return inbox_stats


def get_inbox_reason_text(group_inbox: Optional[GroupInbox]):
    reason = GroupInboxReason(group_inbox.reason) if group_inbox else None
    if reason == GroupInboxReason.NEW:
        return "New issue"
    elif reason == GroupInboxReason.REGRESSION:
        return "Regressed issue"
    elif reason == GroupInboxReason.ONGOING:
        return "Ongoing issue"
    return "New Alert"
