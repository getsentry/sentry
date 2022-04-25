from typing import Any, Iterable

from django.db import models
from django.db.models.signals import post_save

from sentry.db.models import (
    BaseManager,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    sane_repr,
)

COMMIT_FILE_CHANGE_TYPES = frozenset(("A", "D", "M"))


class CommitFileChangeManager(BaseManager):
    def get_count_for_commits(self, commits: Iterable[Any]) -> int:
        return int(self.filter(commit__in=commits).values("filename").distinct().count())


class CommitFileChange(Model):
    __include_in_export__ = False

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


def process_resource_change(instance, **kwargs):
    from sentry.integrations.github.integration import GitHubIntegration
    from sentry.integrations.gitlab.integration import GitlabIntegration
    from sentry.tasks.codeowners import code_owners_auto_sync

    filepaths = set(GitHubIntegration.codeowners_locations) | set(
        GitlabIntegration.codeowners_locations
    )

    # CODEOWNERS file added or modified, trigger auto-sync
    if instance.filename in filepaths and instance.type in ["A", "M"]:
        # Trigger the task after 5min to make sure all records in the transactions has been saved.
        code_owners_auto_sync.apply_async(
            kwargs={"commit_id": instance.commit_id}, countdown=60 * 5
        )


post_save.connect(
    lambda instance, **kwargs: process_resource_change(instance, **kwargs),
    sender=CommitFileChange,
    weak=False,
)
