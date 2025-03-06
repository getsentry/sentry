from __future__ import annotations

import itertools
from collections import defaultdict
from collections.abc import Sequence
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, TypedDict

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_model
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
    type: str
    owner: str
    date_added: datetime


@region_silo_model
class GroupOwner(Model):
    """
    Tracks the "owners" or "suggested assignees" of a group.
    """

    __relocation_scope__ = RelocationScope.Excluded

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
    context: models.Field[dict[str, Any], dict[str, Any]] = JSONField(null=True)
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, on_delete="CASCADE", null=True)
    team = FlexibleForeignKey("sentry.Team", null=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupowner"

    def save(self, *args, **kwargs):
        keys = [k for k in (self.user_id, self.team_id) if k is not None]
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
        from sentry.types.actor import Actor

        if not self.owner_id():
            return None

        return Actor.from_identifier(self.owner_id())

    @classmethod
    def get_autoassigned_owner(cls, group_id, project_id, autoassignment_types):
        """
        Non-cached read access to find the autoassigned GroupOwner.
        """

        # Ordered by date_added as well to ensure that the first GroupOwner is returned
        # Multiple GroupOwners can be created but they are created in the correct evaluation order, so the first one takes precedence
        issue_owner = (
            cls.objects.filter(
                group_id=group_id, project_id=project_id, type__in=autoassignment_types
            )
            .exclude(user_id__isnull=True, team_id__isnull=True)
            .order_by("type", "date_added")
            .first()
        )
        # should return False if no owner
        if issue_owner is None:
            return False
        return issue_owner

    @classmethod
    def invalidate_debounce_issue_owners_evaluation_cache(cls, project_id, group_id=None):
        """
        If `group_id` is provided, clear the debounce issue owners cache for that group, else clear
        the cache of all groups for a project that had an event within the
        ISSUE_OWNERS_DEBOUNCE_DURATION window.
        """
        if group_id:
            cache.delete(ISSUE_OWNERS_DEBOUNCE_KEY(group_id))
            return

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
    def invalidate_assignee_exists_cache(cls, project_id, group_id=None):
        """
        If `group_id` is provided, clear the assignee exists cache for that group, else
        clear the cache of all groups for a project that had an event within the
        ASSIGNEE_EXISTS_DURATION window.
        """
        if group_id:
            cache.delete(ASSIGNEE_EXISTS_KEY(group_id))
            return

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


def get_owner_details(group_list: Sequence[Group]) -> dict[int, list[OwnersSerialized]]:
    group_ids = [g.id for g in group_list]
    group_owners = GroupOwner.objects.filter(group__in=group_ids).exclude(
        user_id__isnull=True, team_id__isnull=True
    )
    owner_details = defaultdict(list)
    for go in group_owners:
        owner_details[go.group_id].append(
            OwnersSerialized(
                type=GROUP_OWNER_TYPE[GroupOwnerType(go.type)],
                owner=go.owner().identifier,
                date_added=go.date_added,
            ),
        )

    return owner_details
