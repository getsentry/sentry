from collections import defaultdict
from enum import Enum
from typing import List, TypedDict

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry import features
from sentry.db.models import FlexibleForeignKey, Model


class GroupOwnerType(Enum):
    SUSPECT_COMMIT = 0
    OWNERSHIP_RULE = 1
    RELEASE_COMMITS = 2


GROUP_OWNER_TYPE = {
    GroupOwnerType.SUSPECT_COMMIT: "suspectCommit",
    GroupOwnerType.OWNERSHIP_RULE: "ownershipRule",
    GroupOwnerType.RELEASE_COMMITS: "releaseCommits",
}


class OwnersSerialized(TypedDict):
    type: GroupOwnerType
    author: str
    commits: models.DateTimeField


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


def get_owner_details(group_list: List[int]) -> List[OwnersSerialized]:
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

    org = group_owners[0].organization if len(group_owners) > 0 else None
    if org and features.has("organizations:release-committer-assignees", org):
        for g in group_ids:
            # TODO(snigdha): optimize this to bulk grab committer data for all groups
            release_committers_owners = get_release_committers_for_group(g)
            for rc_owner in release_committers_owners:
                owner_details[g].append(rc_owner)

    return owner_details


# Get all committers for all releases for a group.
# TODO(snigdha): this should to be refactored to be performant enough to be used beyond Sentry.
def get_release_committers_for_group(group_id: List[int]) -> List[OwnersSerialized]:
    from sentry.api.serializers import get_users_for_authors
    from sentry.models import GroupRelease, ReleaseCommit

    group_releases = GroupRelease.objects.filter(group_id=group_id).values_list(
        "release_id", flat=True
    )

    release_commits = list(
        filter(
            lambda rc: rc.commit and rc.commit.author,
            ReleaseCommit.objects.filter(release__in=group_releases).select_related(
                "commit", "release", "commit__author"
            ),
        )
    )

    if not release_commits:
        return []

    author_to_user = get_users_for_authors(
        release_commits[0].organization_id,
        [_rc.commit.author for _rc in release_commits],
    )

    # List(Tuple(release_commit, user)
    rc_user = [
        (rc, author_to_user.get(str(rc.commit.author.id)))
        for rc in release_commits
        if author_to_user.get(str(rc.commit.author.id))
    ]

    # Aggregate all release commits to a user
    # Dict[user.id, List(release_commits)]
    user_to_rc = defaultdict(list)
    for rc, user in rc_user:
        if user.get("id"):
            user_to_rc[user.get("id")].append(rc)

    # Reduce the list of release commits for a user by the latest commit.date_added
    # Dict[user.id, release_commits]
    user_to_latest_rc = {
        user_id: max(rc_list, key=lambda rc: rc.commit.date_added)
        for user_id, rc_list in user_to_rc.items()
    }

    return [
        {
            "type": GROUP_OWNER_TYPE[GroupOwnerType.RELEASE_COMMITS],
            "owner": f"user:{user_id}",
            "date_added": latest_rc.commit.date_added,
        }
        for user_id, latest_rc in user_to_latest_rc.items()
    ]
