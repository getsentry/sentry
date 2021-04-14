import logging
from enum import Enum

import jsonschema
from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, JSONField, Model
from sentry.models import Activity
from sentry.signals import inbox_in, inbox_out

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
    UNIGNORED = 1
    REGRESSION = 2
    MANUAL = 3
    REPROCESSED = 4


class GroupInboxRemoveAction(Enum):
    RESOLVED = "resolved"
    IGNORED = "ignored"
    MARK_REVIEWED = "mark_reviewed"


class GroupInbox(Model):
    """
    A Group that is in the inbox.
    """

    __core__ = False

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

    # Ignore new issues, too many events
    if reason is not GroupInboxReason.NEW:
        inbox_in.send_robust(
            project=group.project,
            user=None,
            group=group,
            sender="add_group_to_inbox",
            reason=reason.name.lower(),
        )
    return group_inbox


def remove_group_from_inbox(group, action=None, user=None, referrer=None):
    try:
        group_inbox = GroupInbox.objects.get(group=group)
        group_inbox.delete()

        if action is GroupInboxRemoveAction.MARK_REVIEWED and user is not None:
            Activity.objects.create(
                project_id=group_inbox.group.project_id,
                group_id=group_inbox.group_id,
                type=Activity.MARK_REVIEWED,
                user=user,
            )

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
