from collections import defaultdict
from enum import Enum

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model


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

    # quick and dirty way to get release committers
    def _get_release_committers_for_group(group_id):
        from sentry.api.serializers import get_users_for_authors
        from sentry.models import GroupRelease, ReleaseCommit

        # if ReleaseCommit.objects.filter(
        #         commit__pullrequestcommit__pull_request__in=pr_ids
        # ).exists():
        # pr_ids = PullRequest.objects.filter(
        #     pullrequestcommit__commit=latest_issue_commit_resolution.linked_id
        # ).values_list("id", flat=True)
        # # assume that this commit has been released if any commits in this PR have been released
        # if ReleaseCommit.objects.filter(
        #         commit__pullrequestcommit__pull_request__in=pr_ids
        # ).exists():
        # group_id -> GroupRelease -> Release ->
        group_releases = GroupRelease.objects.filter(group_id=group_id).values_list(
            "release_id", flat=True
        )

        # ReleaseCommit -> Commit -> CommitAuthor
        release_commits = ReleaseCommit.objects.filter(release__in=group_releases).select_related(
            "commit", "release", "commit__author"
        )

        if not release_commits.exists():
            return []

        author_to_user = get_users_for_authors(
            release_commits[0].organization_id,
            [_rc.commit.author for _rc in release_commits if _rc.commit and _rc.commit.author],
        )
        return [
            {"type": "releaseCommitters", "owner": f"user:{user.id}", "date_added": ""}
            for user in author_to_user
            if user.get("id")
        ]

    org = next(iter([g.organization for g in group_owners] or []), None)
    from sentry import features

    if org and features.has("organizations:release-committer-assignees", org):
        for g in group_ids:
            release_committers = _get_release_committers_for_group(g)
            for rc in release_committers:
                owner_details[g].append(rc)

    return owner_details
