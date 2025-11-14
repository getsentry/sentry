from collections.abc import Iterable
from typing import Any, ClassVar, int

from django.db import models, router, transaction
from django.db.models.signals import post_save

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, Model, region_silo_model, sane_repr
from sentry.db.models.manager.base import BaseManager

COMMIT_FILE_CHANGE_TYPES = frozenset(("A", "D", "M"))


__all__ = ("CommitFileChange",)


class CommitFileChangeManager(BaseManager["CommitFileChange"]):
    def get_count_for_commits(self, commits: Iterable[Any]) -> int:
        return int(
            self.filter(commit_id__in=[c.id for c in commits]).values("filename").distinct().count()
        )


@region_silo_model
class CommitFileChange(Model):
    __relocation_scope__ = RelocationScope.Excluded

    organization_id = BoundedBigIntegerField(db_index=True)
    commit_id = BoundedBigIntegerField(db_index=True)
    filename = models.TextField()
    type = models.CharField(
        max_length=1, choices=(("A", "Added"), ("D", "Deleted"), ("M", "Modified"))
    )

    objects: ClassVar[CommitFileChangeManager] = CommitFileChangeManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_commitfilechange"
        unique_together = (("commit_id", "filename"),)

    __repr__ = sane_repr("commit_id", "filename")

    @staticmethod
    def is_valid_type(value: str) -> bool:
        return value in COMMIT_FILE_CHANGE_TYPES


def process_resource_change(instance, **kwargs):
    from sentry.integrations.bitbucket.integration import BitbucketIntegration
    from sentry.integrations.bitbucket_server.integration import BitbucketServerIntegration
    from sentry.integrations.github.integration import GitHubIntegration
    from sentry.integrations.gitlab.integration import GitlabIntegration
    from sentry.integrations.vsts.integration import VstsIntegration
    from sentry.tasks.codeowners import code_owners_auto_sync

    def _spawn_task():
        filepaths = (
            set(GitHubIntegration.codeowners_locations)
            | set(GitlabIntegration.codeowners_locations)
            | set(BitbucketIntegration.codeowners_locations)
            | set(BitbucketServerIntegration.codeowners_locations)
            | set(VstsIntegration.codeowners_locations)
        )

        # CODEOWNERS file added or modified, trigger auto-sync
        if instance.filename in filepaths and instance.type in ["A", "M"]:
            code_owners_auto_sync.delay(commit_id=instance.commit_id)

    transaction.on_commit(_spawn_task, router.db_for_write(CommitFileChange))


def post_bulk_create(file_changes: Iterable[CommitFileChange]) -> None:
    """
    Process file changes following bulk_create.
    """
    for fc in file_changes:
        process_resource_change(fc)


# TODO: When we delete this file, make sure we enable this for the new `CommitFileChange` model
post_save.connect(
    lambda instance, **kwargs: process_resource_change(instance, **kwargs),
    sender=CommitFileChange,
    weak=False,
)
