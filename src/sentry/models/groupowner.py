from __future__ import absolute_import

from enum import Enum

from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model


class GroupOwnerType(Enum):
    SUSPECT_COMMIT = 0
    OWNERSHIP_RULE = 1


class GroupOwner(Model):
    """
    Tracks the "owners" or "suggested assignees" or a group.
    """

    __core__ = False

    group = FlexibleForeignKey("sentry.Group", unique=True, db_constraint=False)
    project = FlexibleForeignKey("sentry.Project", null=False, db_constraint=False)
    organization = FlexibleForeignKey("sentry.Organization", null=False, db_constraint=False)
    owner_type = models.PositiveSmallIntegerField(null=False)
    # ID of team/user, based on owner_type
    # Wondering if this should just be team_id and user_id as nullable foreign keys and one is just not used per entry.
    owner_id = models.PositiveSmallIntegerField(null=False)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupowner"
