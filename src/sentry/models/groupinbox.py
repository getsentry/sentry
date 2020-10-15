from __future__ import absolute_import

from enum import Enum

from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, JSONField


class GroupInboxReason(Enum):
    NEW = 0
    UNIGNORED = 1
    REGRESSION = 2


class GroupInbox(Model):
    """
    A Group that is in the inbox.
    """

    __core__ = False

    group = FlexibleForeignKey("sentry.Group", unique=True, db_constraint=False)
    reason = models.PositiveSmallIntegerField(null=False, default=GroupInboxReason.NEW.value)
    reason_details = JSONField(null=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupinbox"
