from __future__ import absolute_import

from enum import Enum

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model
from sentry.utils.compat import filter


class GroupOwnerType(Enum):
    SUSPECT_COMMIT = 0
    OWNERSHIP_RULE = 1


class GroupOwner(Model):
    """
    Tracks the "owners" or "suggested assignees" of a group.
    """

    __core__ = False

    group = FlexibleForeignKey("sentry.Group", db_constraint=False)
    project = FlexibleForeignKey("sentry.Project", db_constraint=False)
    organization = FlexibleForeignKey("sentry.Organization", db_constraint=False)
    type = models.PositiveSmallIntegerField(
        choices=(
            (GroupOwnerType.SUSPECT_COMMIT, u"Suspect Commit"),
            (GroupOwnerType.OWNERSHIP_RULE, u"Ownership Rule"),
        )
    )
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, null=True)
    team = FlexibleForeignKey("sentry.Team", null=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupowner"

    def save(self, *args, **kwargs):
        keys = list(filter(None, [self.user_id, self.team_id]))
        assert len(keys) == 1, "Must have team or user, not both"
        super(GroupOwner, self).save(*args, **kwargs)

    def owner_id(self):
        if self.user_id:
            return u"user:{}".format(self.user_id)

        if self.team_id:
            return u"team:{}".format(self.team_id)

        raise NotImplementedError("Unknown Owner")

    def owner(self):
        from sentry.api.fields.actor import Actor

        return Actor.from_actor_identifier(self.owner_id())
