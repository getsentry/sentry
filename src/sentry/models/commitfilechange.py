from typing import Any, ClassVar, Iterable

from django.db import models, router, transaction
from django.db.models.signals import post_save

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BaseManager,
    BoundedBigIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_only_model,
    sane_repr,
)

COMMIT_FILE_CHANGE_TYPES = frozenset(("A", "D", "M"))


class CommitFileChangeManager(BaseManager["CommitFileChange"]):
    def get_count_for_commits(self, commits: Iterable[Any]) -> int:
        return int(self.filter(commit__in=commits).values("filename").distinct().count())


@region_silo_only_model
class CommitFileChange(Model):
    __relocation_scope__ = RelocationScope.Excluded

    organization_id = BoundedBigIntegerField(db_index=True)
    commit = FlexibleForeignKey("sentry.Commit")
    filename = models.TextField()
    type = models.CharField(
        max_length=1, choices=(("A", "Added"), ("D", "Deleted"), ("M", "Modified"))
    )

    objects: ClassVar[CommitFileChangeManager] = CommitFileChangeManager()

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

    def _spawn_task():
        filepaths = set(GitHubIntegration.codeowners_locations) | set(
            GitlabIntegration.codeowners_locations
        )

        # CODEOWNERS file added or modified, trigger auto-sync
        if instance.filename in filepaths and instance.type in ["A", "M"]:
            # Trigger the task after 5min to make sure all records in the transactions has been saved.
            code_owners_auto_sync.apply_async(
                kwargs={"commit_id": instance.commit_id}, countdown=60 * 5
            )

    transaction.on_commit(_spawn_task, router.db_for_write(CommitFileChange))


post_save.connect(
    lambda instance, **kwargs: process_resource_change(instance, **kwargs),
    sender=CommitFileChange,
    weak=False,
)
