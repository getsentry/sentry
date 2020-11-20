from __future__ import absolute_import

from enum import Enum

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model


class GroupOwnerType(Enum):
    SUSPECT_COMMIT = 0
    OWNERSHIP_RULE = 1


class GroupOwner(Model):
    """
    Tracks the "owners" or "suggested assignees" of a group.
    """

    __core__ = False

    group = FlexibleForeignKey("sentry.Group", unique=True, db_constraint=False)
    project = FlexibleForeignKey("sentry.Project", null=False, db_constraint=False)
    organization = FlexibleForeignKey("sentry.Organization", null=False, db_constraint=False)
    owner_type = models.PositiveSmallIntegerField(null=False)
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, related_name="sentry_owner_set", null=True)
    team = FlexibleForeignKey("sentry.Team", related_name="sentry_owner_set", null=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupowner"

    def save(self, *args, **kwargs):
        assert not (self.user_id is not None and self.team_id is not None) and not (
            self.user_id is None and self.team_id is None
        ), "Must have Team or User, not both"
        super(GroupOwner, self).save(*args, **kwargs)

    def owner_id(self):
        if self.user:
            return u"user:{}".format(self.user_id)

        if self.team_id:
            return u"team:{}".format(self.team_id)

        raise NotImplementedError("Unknown Owner")

    def owner(self):
        from sentry.api.fields.actor import Actor

        return Actor.from_actor_identifier(self.owner_id())
