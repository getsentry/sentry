from __future__ import annotations

from collections.abc import Iterable
from typing import TYPE_CHECKING, Any, ClassVar

from django.db import models
from django.db.models.query import QuerySet
from django.utils import timezone
from django.utils.functional import cached_property

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    DefaultFieldsModel,
    FlexibleForeignKey,
    Model,
    region_silo_model,
    sane_repr,
)
from sentry.db.models.manager.base import BaseManager
from sentry.utils.groupreference import find_referenced_groups

if TYPE_CHECKING:
    from sentry.models.group import Group
    from sentry.models.release import Release

COMMIT_FILE_CHANGE_TYPES = frozenset(("A", "D", "M"))


class CommitManager(BaseManager["Commit"]):
    def get_for_release(self, release: Release) -> QuerySet[Commit]:
        return (
            self.filter(releasecommit__release=release)
            .order_by("-releasecommit__order")
            .select_related("author")
        )


@region_silo_model
class Commit(Model):
    __relocation_scope__ = RelocationScope.Excluded

    organization_id = BoundedBigIntegerField(db_index=True)
    repository_id = BoundedPositiveIntegerField()
    key = models.CharField(max_length=64)
    date_added = models.DateTimeField(default=timezone.now)
    # XXX: We already overwrite `date_added` with the timestamp from the commit.
    # This breaks our usual convention, but it's simpler to add the db write time
    # as a new column than to try and migrate the data
    date_created = models.DateTimeField(auto_now_add=True)
    # all commit metadata must be optional, as it may not be available
    # when the initial commit object is referenced (and thus created)
    # TODO: related_name can be changed once we switch to using this table and remove the old one
    author = FlexibleForeignKey("sentry.CommitAuthor", null=True, related_name="releasecommit_set")
    message = models.TextField(null=True)

    objects: ClassVar[CommitManager] = CommitManager()

    class Meta:
        app_label = "releases"
        db_table = "releases_commit"
        indexes = (
            models.Index(fields=("repository_id", "date_added")),
            models.Index(fields=("author", "date_added")),
            models.Index(fields=("organization_id", "date_added")),
        )
        unique_together = (("repository_id", "key"),)

    __repr__ = sane_repr("organization_id", "repository_id", "key")

    @cached_property
    def title(self):
        if not self.message:
            return ""
        return self.message.splitlines()[0]

    @cached_property
    def short_id(self):
        if len(self.key) == 40:
            return self.key[:7]
        return self.key

    def find_referenced_groups(self) -> set[Group]:
        return find_referenced_groups(self.message, self.organization_id)


class CommitFileChangeManager(BaseManager["CommitFileChange"]):
    def get_count_for_commits(self, commits: Iterable[Any]) -> int:
        return int(
            self.filter(commit_id__in=[c.id for c in commits]).values("filename").distinct().count()
        )


@region_silo_model
class CommitFileChange(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    organization_id = BoundedBigIntegerField(db_index=True)
    commit = FlexibleForeignKey("releases.Commit")
    filename = models.TextField()
    type = models.CharField(
        max_length=1, choices=(("A", "Added"), ("D", "Deleted"), ("M", "Modified"))
    )

    objects: ClassVar[CommitFileChangeManager] = CommitFileChangeManager()

    class Meta:
        app_label = "releases"
        db_table = "releases_commitfilechange"
        unique_together = (("commit", "filename"),)

    __repr__ = sane_repr("commit_id", "filename")

    @staticmethod
    def is_valid_type(value: str) -> bool:
        return value in COMMIT_FILE_CHANGE_TYPES


# TODO: Make sure we uncomment this, or put this behind a feature flag
# post_save.connect(
#     lambda instance, **kwargs: process_resource_change(instance, **kwargs),
#     sender=CommitFileChange,
#     weak=False,
# )
