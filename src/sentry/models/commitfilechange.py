from typing import Any, Iterable, Optional

from django.db import models

from sentry.db.models import (
    BaseManager,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    sane_repr,
)

COMMIT_FILE_CHANGE_TYPES = frozenset(("A", "D", "M"))


class CommitFileChangeManager(BaseManager):
    def get_count_for_commits(
        self, commits: Iterable[Any], organization_id: Optional[int] = None
    ) -> int:
        """
        Warning: Because `sentry_commitfilechange` has no `organization_id`
        index, do not pass an `organization_id` if there are many commits.
        """
        kwargs = {"commit__in": commits}
        if organization_id:
            kwargs["organization_id"] = organization_id

        return int(self.filter(**kwargs).values("filename").distinct().count())


class CommitFileChange(Model):
    __core__ = False

    organization_id = BoundedPositiveIntegerField(db_index=True)
    commit = FlexibleForeignKey("sentry.Commit")
    filename = models.CharField(max_length=255)
    type = models.CharField(
        max_length=1, choices=(("A", "Added"), ("D", "Deleted"), ("M", "Modified"))
    )

    objects = CommitFileChangeManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_commitfilechange"
        unique_together = (("commit", "filename"),)

    __repr__ = sane_repr("commit_id", "filename")

    @staticmethod
    def is_valid_type(value: str) -> bool:
        return value in COMMIT_FILE_CHANGE_TYPES
