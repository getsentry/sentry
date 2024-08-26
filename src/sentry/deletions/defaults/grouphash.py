from ..base import ModelDeletionTask, ModelRelation


class GroupHashDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models.grouphashmetadata import GroupHashMetadata

        return [
            ModelRelation(GroupHashMetadata, {"grouphash_id": instance.id}),
        ]
