from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.models.grouphash import GroupHash


class GroupHashDeletionTask(ModelDeletionTask[GroupHash]):
    DEFAULT_CHUNK_SIZE = 10000

    def get_child_relations(self, instance: GroupHash) -> list[BaseRelation]:
        print("GroupHashDeletionTask.get_child_relations")
        from sentry.models.grouphashmetadata import GroupHashMetadata

        return [
            ModelRelation(GroupHashMetadata, {"grouphash_id": instance.id}),
        ]
