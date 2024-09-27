from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.models.grouphash import GroupHash


class GroupHashDeletionTask(ModelDeletionTask[GroupHash]):
    def get_child_relations(self, instance: GroupHash) -> list[BaseRelation]:
        from sentry.models.grouphashmetadata import GroupHashMetadata

        return [
            ModelRelation(GroupHashMetadata, {"grouphash_id": instance.id}),
        ]
