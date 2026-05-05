from django.db import router, transaction

from sentry.constants import ObjectStatus
from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.deletions.tasks.seer import notify_seer_repository_deleted
from sentry.models.repository import Repository
from sentry.signals import pending_delete


def _get_repository_child_relations(instance: Repository) -> list[BaseRelation]:
    from sentry.integrations.models.repository_project_path_config import (
        RepositoryProjectPathConfig,
    )
    from sentry.models.commit import Commit
    from sentry.models.pullrequest import PullRequest

    return [
        ModelRelation(Commit, {"repository_id": instance.id}),
        ModelRelation(PullRequest, {"repository_id": instance.id}),
        ModelRelation(RepositoryProjectPathConfig, {"repository_id": instance.id}),
    ]


class RepositoryDeletionTask(ModelDeletionTask[Repository]):
    def should_proceed(self, instance: Repository) -> bool:
        """
        Only delete repositories that haven't been undeleted.
        """
        return instance.status in {ObjectStatus.PENDING_DELETION, ObjectStatus.DELETION_IN_PROGRESS}

    def get_child_relations(self, instance: Repository) -> list[BaseRelation]:
        from sentry.seer.models.project_repository import SeerProjectRepository

        return _get_repository_child_relations(instance) + [
            # We only delete SeerProjectRepository when the repo is actually deleted,
            # but not when it's hidden/disabled (repository_cascade_delete_on_hide).
            ModelRelation(SeerProjectRepository, {"repository_id": instance.id}),
        ]

    def delete_instance(self, instance: Repository) -> None:
        # TODO: child_relations should also send pending_delete so we
        # don't have to do this here.
        pending_delete.send(sender=type(instance), instance=instance, actor=self.get_actor())

        organization_id = instance.organization_id
        repository_id = instance.id
        provider = instance.provider
        repository_name = instance.name

        transaction.on_commit(
            lambda: notify_seer_repository_deleted.delay(
                organization_id,
                repository_id,
                provider,
                repository_name,
            ),
            using=router.db_for_write(Repository),
        )

        return super().delete_instance(instance)
