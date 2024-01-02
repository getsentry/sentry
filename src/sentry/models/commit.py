from __future__ import annotations

from typing import TYPE_CHECKING, ClassVar

from django.db import models
from django.db.models.query import QuerySet
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BaseManager,
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_only_model,
    sane_repr,
)
from sentry.utils.cache import memoize
from sentry.utils.groupreference import find_referenced_groups

if TYPE_CHECKING:
    from sentry.models.release import Release


class CommitManager(BaseManager["Commit"]):
    def get_for_release(self, release: Release) -> QuerySet[Commit]:
        return (
            self.filter(releasecommit__release=release)
            .order_by("-releasecommit__order")
            .select_related("author")
        )


@region_silo_only_model
class Commit(Model):
    __relocation_scope__ = RelocationScope.Excluded

    organization_id = BoundedBigIntegerField(db_index=True)
    repository_id = BoundedPositiveIntegerField()
    key = models.CharField(max_length=64, db_index=True)
    date_added = models.DateTimeField(default=timezone.now)
    # all commit metadata must be optional, as it may not be available
    # when the initial commit object is referenced (and thus created)
    author = FlexibleForeignKey("sentry.CommitAuthor", null=True)
    message = models.TextField(null=True)

    objects: ClassVar[CommitManager] = CommitManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_commit"
        index_together = (
            ("repository_id", "date_added"),
            ("author", "date_added"),
            ("organization_id", "date_added"),
        )
        unique_together = (("repository_id", "key"),)

    __repr__ = sane_repr("organization_id", "repository_id", "key")

    @memoize
    def title(self):
        if not self.message:
            return ""
        return self.message.splitlines()[0]

    @memoize
    def short_id(self):
        if len(self.key) == 40:
            return self.key[:7]
        return self.key

    def find_referenced_groups(self):
        return find_referenced_groups(self.message, self.organization_id)
