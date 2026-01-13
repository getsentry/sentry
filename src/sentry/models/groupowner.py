from __future__ import annotations

import itertools
from collections import defaultdict
from collections.abc import Sequence
from datetime import datetime, timedelta
from enum import Enum, StrEnum
from typing import ClassVar, TypedDict

from django.conf import settings
from django.db import models
from django.db.models import BigIntegerField, F
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Cast
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.fields.jsonfield import LegacyTextJSONField
from sentry.db.models.manager.base import BaseManager
from sentry.models.group import Group
from sentry.utils.cache import cache

READ_CACHE_DURATION = 3600
ISSUE_OWNERS_DEBOUNCE_KEY = lambda group_id: f"owner_exists:1:{group_id}"
ISSUE_OWNERS_DEBOUNCE_DURATION = 60 * 60 * 24
ASSIGNEE_EXISTS_KEY = lambda group_id: f"assignee_exists:1:{group_id}"
ASSIGNEE_EXISTS_DURATION = 60 * 60 * 24
ASSIGNEE_DOES_NOT_EXIST_DURATION = 60
PROJECT_OWNERSHIP_VERSION_KEY = lambda project_id: f"ownership_version:1:{project_id}"
PROJECT_OWNERSHIP_VERSION_DURATION = 60 * 60 * 24


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


class SuspectCommitStrategy(StrEnum):
    RELEASE_BASED = "release_based"  # legacy strategy, used as fallback if scm_based fails
    SCM_BASED = "scm_based"


class OwnersSerialized(TypedDict):
    type: str
    owner: str
    date_added: datetime


class GroupOwnerManager(BaseManager["GroupOwner"]):
    def update_or_create_and_preserve_context(
        self, lookup_kwargs: dict, defaults: dict, context_defaults: dict
    ) -> tuple[GroupOwner, bool]:
        """
        update_or_create doesn't have great support for json fields like context.
        To preserve the existing content and update only the keys we specify,
        we have to handle the operation this way.

        use lookup_kwargs to perform the .get()
        if found: update the object with defaults and the context with context_defaults
        if not found: create the object with the values in lookup_kwargs, defaults, and context_defaults

        Note: lookup_kwargs is modified if the GroupOwner is created, do not reuse it for other purposes!
        """
        try:
            group_owner = GroupOwner.objects.annotate(
                context__asjsonb=Cast("context", models.JSONField())
            ).get(**lookup_kwargs)

            for k, v in defaults.items():
                setattr(group_owner, k, v)

            existing_context = group_owner.context or {}
            existing_context.update(context_defaults)
            group_owner.context = existing_context

            group_owner.save()
            return group_owner, False
        except GroupOwner.DoesNotExist:
            # modify lookup_kwargs so they can be used to create the GroupOwner
            keys_to_delete = [k for k in lookup_kwargs.keys() if "__" in k]
            for k in keys_to_delete:
                del lookup_kwargs[k]

            lookup_kwargs.update(defaults)
            lookup_kwargs["context"] = context_defaults

            return GroupOwner.objects.create(**lookup_kwargs), True


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
    context = LegacyTextJSONField(null=True)
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, on_delete="CASCADE", null=True)
    team = FlexibleForeignKey("sentry.Team", null=True)
    date_added = models.DateTimeField(default=timezone.now)

    objects: ClassVar[GroupOwnerManager] = GroupOwnerManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupowner"

        indexes = [
            models.Index(
                F("type"),
                Cast(
                    KeyTextTransform(
                        "commitId",
                        Cast(F("context"), models.JSONField()),
                    ),
                    BigIntegerField(),
                ),
                name="groupowner_type_json_commitid",
            ),
        ]

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
    def invalidate_debounce_issue_owners_evaluation_cache(cls, group_id):
        """
        Clear the debounce issue owners cache for a specific group.
        """
        cache.delete(ISSUE_OWNERS_DEBOUNCE_KEY(group_id))

    # TODO(shashank): can make this O(1) cache invalidation by using the project ownership version timestamp (follow-up PR)
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

    @classmethod
    def set_project_ownership_version(cls, project_id: int) -> float:
        """
        Set the project ownership version timestamp when ownership rules change.

        When ownership rules (ProjectCodeOwners or ProjectOwnership) change, we set a
        timestamp. During debounce checks, we compare the group's debounce timestamp
        against this version timestamp to determine if re-evaluation is needed.

        Returns the timestamp that was set.
        """
        version_time = timezone.now().timestamp()
        cache.set(
            PROJECT_OWNERSHIP_VERSION_KEY(project_id),
            version_time,
            PROJECT_OWNERSHIP_VERSION_DURATION,
        )
        return version_time

    @classmethod
    def get_project_ownership_version(cls, project_id: int) -> float | None:
        """
        Get the project ownership version timestamp.

        Returns the timestamp when ownership rules were last changed, or None if not set.
        """
        return cache.get(PROJECT_OWNERSHIP_VERSION_KEY(project_id))


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
