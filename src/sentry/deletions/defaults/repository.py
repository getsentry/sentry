from sentry.constants import ObjectStatus
from sentry.signals import pending_delete

from ..base import ModelDeletionTask, ModelRelation


def _get_repository_child_relations(instance):
    from sentry.models.commit import Commit
    from sentry.models.integrations.repository_project_path_config import (
        RepositoryProjectPathConfig,
    )
    from sentry.models.pullrequest import PullRequest

    return [
        ModelRelation(Commit, {"repository_id": instance.id}),
        ModelRelation(PullRequest, {"repository_id": instance.id}),
        ModelRelation(RepositoryProjectPathConfig, {"repository_id": instance.id}),
    ]


class RepositoryDeletionTask(ModelDeletionTask):
    def should_proceed(self, instance):
        """
        Only delete repositories that haven't been undeleted.
        """
        return instance.status in {ObjectStatus.PENDING_DELETION, ObjectStatus.DELETION_IN_PROGRESS}

    def get_child_relations(self, instance):
        return _get_repository_child_relations(instance)

    def delete_instance(self, instance):
        # TODO child_relations should also send pending_delete so we
        # don't have to do this here.
        pending_delete.send(sender=type(instance), instance=instance, actor=self.get_actor())

        return super().delete_instance(instance)
