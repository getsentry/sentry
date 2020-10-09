from __future__ import absolute_import

from enum import Enum

from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model


class GroupInboxReason(Enum):
    NEW = 0
    UNIGNORED = 1
    REGRESSION = 2


class GroupInbox(Model):
    """
    A Group that is in the inbox.
    """

    # TODO: What does this do?
    __core__ = False

    group = FlexibleForeignKey("sentry.Group", unique=True)
    reason = models.PositiveSmallIntegerField(null=False, default=GroupInboxReason.NEW.value)
    # TODO: How does the frontend represent different "reasons"?
    # Perhaps this should be number to map to a reason. If it's a string, how does it work with translations?
    reason_label = models.CharField(max_length=256, blank=True, null=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupinbox"
