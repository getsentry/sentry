from collections import defaultdict
from enum import Enum

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model
from sentry.utils.compat import filter


class GroupOwnerType(Enum):
    SUSPECT_COMMIT = 0
    OWNERSHIP_RULE = 1


GROUP_OWNER_TYPE = {
    GroupOwnerType.SUSPECT_COMMIT: "suspectCommit",
    GroupOwnerType.OWNERSHIP_RULE: "ownershipRule",
}


class GroupOwner(Model):
    """
    Tracks the "owners" or "suggested assignees" of a group.
    """

    __include_in_export__ = False

    group = FlexibleForeignKey("sentry.Group", db_constraint=False)
    project = FlexibleForeignKey("sentry.Project", db_constraint=False)
    organization = FlexibleForeignKey("sentry.Organization", db_constraint=False)
    type = models.PositiveSmallIntegerField(
        choices=(
            (GroupOwnerType.SUSPECT_COMMIT, "Suspect Commit"),
            (GroupOwnerType.OWNERSHIP_RULE, "Ownership Rule"),
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
        super().save(*args, **kwargs)

    def owner_id(self):
        if self.user_id:
            return f"user:{self.user_id}"

        if self.team_id:
            return f"team:{self.team_id}"

        raise NotImplementedError("Unknown Owner")

    def owner(self):
        from sentry.models import ActorTuple

        return ActorTuple.from_actor_identifier(self.owner_id())


def get_owner_details(group_list):
    group_ids = [g.id for g in group_list]
    group_owners = GroupOwner.objects.filter(group__in=group_ids)
    owner_details = defaultdict(list)
    for go in group_owners:
        owner_details[go.group_id].append(
            {
                "type": GROUP_OWNER_TYPE[GroupOwnerType(go.type)],
                "owner": go.owner().get_actor_identifier(),
                "date_added": go.date_added,
            }
        )

    return owner_details
