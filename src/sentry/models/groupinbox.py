from __future__ import absolute_import

from enum import Enum

from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, JSONField


class GroupInboxReason(Enum):
    NEW = 0
    UNIGNORED = 1
    REGRESSION = 2
    MANUAL = 3


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
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupinbox"


def add_group_to_inbox(group, reason, reason_details=None):
    group_inbox, created = GroupInbox.objects.get_or_create(
        group=group,
        defaults={
            "project": group.project,
            "organization_id": group.project.organization_id,
            "reason": reason.value,
            "reason_details": reason_details,
        },
    )
    return group_inbox


def remove_group_from_inbox(group):
    try:
        group_inbox = GroupInbox.objects.get(group=group)
        group_inbox.delete()
    except GroupInbox.DoesNotExist:
        pass
