from sentry.deletions.base import ModelDeletionTask
from sentry.models.grouphistory import GroupHistory


# XXX: Once we remove prev_history from GroupHistory, we can simplify this to a regular BulkModelDeletionTask.
class GroupHistoryDeletionTask(ModelDeletionTask[GroupHistory]):
    """
    Specialized deletion handling that operates per group

    Operating per group allows us to delete records more efficiently
    than instance level deletions would, but avoids the constraint
    issues that can occur when using BulkModelDeletionTask
    as GroupHistory instances can have prev_history relations that
    span 10000 ID values.
    """

    def chunk(self, apply_filter: bool = False) -> bool:
        group_ids = self.query.get("group_id__in", [])
        if not group_ids:
            # If we don't have group_id conditions
            # we can't delete by group.
            return super().chunk()

        for group_id in group_ids:
            queryset = self.model.objects.filter(group_id=group_id)
            while True:
                chunk_ids = list(queryset.values_list("id", flat=True)[:10000])
                if not chunk_ids:
                    break
                # Delete records for these IDs
                self.model.objects.filter(id__in=chunk_ids).delete()

        return False
