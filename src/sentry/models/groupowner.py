from __future__ import absolute_import

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, sane_repr


class OwnershipType(object):
    COMMIT = 1
    RULE = 2


class GroupOwner(Model):
    __core__ = False

    project = FlexibleForeignKey("sentry.Project", related_name="owner_set")
    group = FlexibleForeignKey("sentry.Group", related_name="owner_set", unique=True)
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, related_name="sentry_owner_set", null=True)
    ownership_type = models.PositiveSmallIntegerField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupowner"
        unique_together = [("project", "group")]

    __repr__ = sane_repr("group_id", "user_id")
