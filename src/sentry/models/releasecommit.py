from __future__ import annotations

from typing import TYPE_CHECKING

from django.db.models import QuerySet

from sentry.db.models import (
    BaseManager,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    sane_repr,
)

if TYPE_CHECKING:
    from sentry.models import Release


class ReleaseCommitManager(BaseManager):
    def get_for_release(self, release: Release) -> QuerySet[ReleaseCommit]:
        return (
            self.filter(release=release)
            .order_by("order")
            .select_related("commit", "commit__author")
        )


class ReleaseCommit(Model):
    __include_in_export__ = False

    organization_id = BoundedPositiveIntegerField(db_index=True)
    # DEPRECATED
    project_id = BoundedPositiveIntegerField(null=True)
    release = FlexibleForeignKey("sentry.Release")
    commit = FlexibleForeignKey("sentry.Commit")
    order = BoundedPositiveIntegerField()

    objects = ReleaseCommitManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_releasecommit"
        unique_together = (("release", "commit"), ("release", "order"))

    __repr__ = sane_repr("release_id", "commit_id", "order")
