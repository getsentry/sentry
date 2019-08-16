from __future__ import absolute_import, print_function

from sentry.signals import pending_delete

from ..base import ModelDeletionTask, ModelRelation


class RepositoryDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models import Commit

        return [ModelRelation(Commit, {"repository_id": instance.id})]

    def delete_instance(self, instance):
        pending_delete.send(sender=type(instance), instance=instance, actor=self.get_actor())
        return super(RepositoryDeletionTask, self).delete_instance(instance)
