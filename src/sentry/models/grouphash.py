from __future__ import absolute_import

from django.db import models
from django.utils.translation import ugettext_lazy as _

from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model


class GroupHash(Model):
    __core__ = False

    class State:
        UNLOCKED = None
        LOCKED_IN_MIGRATION = 1

    project = FlexibleForeignKey("sentry.Project", null=True)
    hash = models.CharField(max_length=32)
    group = FlexibleForeignKey("sentry.Group", null=True)
    group_tombstone_id = BoundedPositiveIntegerField(db_index=True, null=True)
    state = BoundedPositiveIntegerField(
        choices=[(State.LOCKED_IN_MIGRATION, _("Locked (Migration in Progress)"))], null=True
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_grouphash"
        unique_together = (("project", "hash"),)
