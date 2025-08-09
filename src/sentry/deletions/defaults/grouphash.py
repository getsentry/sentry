from collections.abc import Sequence

from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.models.grouphash import GroupHash
from sentry.models.grouphashmetadata import GroupHashMetadata
from sentry.utils.query import bulk_update


class GroupHashDeletionTask(ModelDeletionTask[GroupHash]):
    def delete_bulk(self, instance_list: Sequence[GroupHash]) -> bool:
        grouphash_ids = [i.id for i in instance_list]
        # This is to avoid the on_delete=SET_NULL on seer_matched_grouphash
        # from creating a massive UPDATE query.
        bulk_update(
            GroupHashMetadata.objects.filter(seer_matched_grouphash_id__in=grouphash_ids),
            {"seer_matched_grouphash_id": None},
            batch_size=1000,
        )
        return super().delete_bulk(instance_list)

    def get_child_relations(self, instance: GroupHash) -> list[BaseRelation]:
        return [
            ModelRelation(GroupHashMetadata, {"grouphash_id": instance.id}),
        ]
