from __future__ import absolute_import, print_function

from ..base import ModelDeletionTask, ModelRelation


class RepositoryDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models import Commit

        return [
            ModelRelation(Commit, {'repository_id': instance.id}),
        ]
