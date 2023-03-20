import itertools
from collections import defaultdict
from datetime import timedelta
from enum import Enum
from typing import Any, List, TypedDict

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, region_silo_only_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.fields.jsonfield import JSONField
from sentry.models.group import Group
from sentry.utils.cache import cache

READ_CACHE_DURATION = 3600
ISSUE_OWNERS_DEBOUNCE_KEY = lambda group_id: f"owner_exists:1:{group_id}"
ISSUE_OWNERS_DEBOUNCE_DURATION = 60 * 60 * 24
ASSIGNEE_EXISTS_KEY = lambda group_id: f"assignee_exists:1:{group_id}"
ASSIGNEE_EXISTS_DURATION = 60 * 60 * 24
ASSIGNEE_DOES_NOT_EXIST_DURATION = 60


class GroupOwnerType(Enum):
    SUSPECT_COMMIT = 0
    OWNERSHIP_RULE = 1
    CODEOWNERS = 2


class OwnerRuleType(Enum):
    OWNERSHIP_RULE = "ownership_rule"
    CODEOWNERS = "codeowners"


GROUP_OWNER_TYPE = {
    GroupOwnerType.SUSPECT_COMMIT: "suspectCommit",
    GroupOwnerType.OWNERSHIP_RULE: "ownershipRule",
    GroupOwnerType.CODEOWNERS: "codeowners",
}


class OwnersSerialized(TypedDict):
    type: GroupOwnerType
    owner: str
    date_added: models.DateTimeField


@region_silo_only_model
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
            (GroupOwnerType.CODEOWNERS, "Codeowners"),
        )
    )
    context = JSONField(null=True)
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, on_delete="CASCADE", null=True)
    team = FlexibleForeignKey("sentry.Team", null=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupowner"

    def save(self, *args, **kwargs):
        keys = list(filter(None, [self.user_id, self.team_id]))
        assert len(keys) != 2, "Must have team or user or neither, not both"
        super().save(*args, **kwargs)

    def owner_id(self):
        if self.user_id:
            return f"user:{self.user_id}"

        if self.team_id:
            return f"team:{self.team_id}"

        if not self.user_id and not self.team_id:
            return None

        raise NotImplementedError("Unknown Owner")

    def owner(self):
        from sentry.models import ActorTuple

        if not self.owner_id():
            return None

        return ActorTuple.from_actor_identifier(self.owner_id())

    @classmethod
    def get_autoassigned_owner_cache_key(self, group_id, project_id, autoassignment_types):
        if not len(autoassignment_types):
            raise Exception("Requires the autoassignment types")
        return f"groupowner_id:{group_id}:{project_id}:{':'.join([str(t) for t in autoassignment_types])}"

    @classmethod
    def get_autoassigned_owner_cached(cls, group_id, project_id, autoassignment_types):
        """
        Cached read access to find the autoassigned GroupOwner.
        """
        cache_key = cls.get_autoassigned_owner_cache_key(group_id, project_id, autoassignment_types)
        issue_owner = cache.get(cache_key)
        if issue_owner is None:
            issue_owner = (
                cls.objects.filter(
                    group_id=group_id, project_id=project_id, type__in=autoassignment_types
                )
                .exclude(user_id__isnull=True, team_id__isnull=True)
                .order_by("type")
                .first()
            )
            if issue_owner is None:
                issue_owner = False
            # Store either the GroupOwner if exists or False for no owners
            cache.set(cache_key, issue_owner, READ_CACHE_DURATION)

        return issue_owner

    @classmethod
    def invalidate_autoassigned_owner_cache(cls, project_id, autoassignment_types):
        # Get all the groups for a project that had an event within the READ_CACHE_DURATION window. Any groups without events in that window would have expired their TTL in the cache.
        queryset = Group.objects.filter(
            project_id=project_id,
            last_seen__gte=timezone.now() - timedelta(seconds=READ_CACHE_DURATION),
        ).values_list("id", flat=True)

        # Run cache invalidation in batches
        group_id_iter = queryset.iterator(chunk_size=1000)
        while True:
            group_ids = list(itertools.islice(group_id_iter, 1000))
            if not group_ids:
                break
            cache_keys = [
                cls.get_autoassigned_owner_cache_key(group_id, project_id, autoassignment_types)
                for group_id in group_ids
            ]
            cache.delete_many(cache_keys)

    @classmethod
    def invalidate_debounce_issue_owners_evaluation_cache(cls, project_id):
        # Get all the groups for a project that had an event within the ISSUE_OWNERS_DEBOUNCE_DURATION window.
        # Any groups without events in that window would have expired their TTL in the cache.
        queryset = Group.objects.filter(
            project_id=project_id,
            last_seen__gte=timezone.now() - timedelta(seconds=ISSUE_OWNERS_DEBOUNCE_DURATION),
        ).values_list("id", flat=True)

        # Run cache invalidation in batches
        group_id_iter = queryset.iterator(chunk_size=1000)
        while True:
            group_ids = list(itertools.islice(group_id_iter, 1000))
            if not group_ids:
                break
            cache_keys = [ISSUE_OWNERS_DEBOUNCE_KEY(group_id) for group_id in group_ids]
            cache.delete_many(cache_keys)

    @classmethod
    def invalidate_assignee_exists_cache(cls, project_id):
        # Get all the groups for a project that had an event within the ASSIGNEE_EXISTS_DURATION window.
        # Any groups without events in that window would have expired their TTL in the cache.
        queryset = Group.objects.filter(
            project_id=project_id,
            last_seen__gte=timezone.now() - timedelta(seconds=ASSIGNEE_EXISTS_DURATION),
        ).values_list("id", flat=True)

        # Run cache invalidation in batches
        group_id_iter = queryset.iterator(chunk_size=1000)
        while True:
            group_ids = list(itertools.islice(group_id_iter, 1000))
            if not group_ids:
                break
            cache_keys = [ASSIGNEE_EXISTS_KEY(group_id) for group_id in group_ids]
            cache.delete_many(cache_keys)


def get_owner_details(group_list: List[Group], user: Any) -> List[OwnersSerialized]:
    group_ids = [g.id for g in group_list]
    group_owners = GroupOwner.objects.filter(group__in=group_ids).exclude(
        user_id__isnull=True, team_id__isnull=True
    )
    owner_details = defaultdict(list)
    for go in group_owners:
        owner_details[go.group_id].append(
            OwnersSerialized(
                type=GROUP_OWNER_TYPE[GroupOwnerType(go.type)],
                owner=go.owner().get_actor_identifier(),
                date_added=go.date_added,
            ),
        )

    return owner_details
