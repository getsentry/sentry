from sentry.deletions.base import ModelDeletionTask
from sentry.models.grouphistory import GroupHistory


class GroupHistoryDeletionTask(ModelDeletionTask[GroupHistory]):
    """
    Specialized deletion handling that operates per group

    Operating per group allows us to delete records more efficiently
    than instance level deletions would, but avoids the constraint
    issues that can occur when using BulkModelDeletionTask
    as GroupHistory instances can have prev_history relations that
    span 10000 ID values.
    """

    def chunk(self) -> bool:
        group_ids = self.query.get("group_id__in", [])
        if not group_ids:
            # If we don't have group_id conditions
            # we can't delete by group.
            return super().chunk()

        for group_id in group_ids:
            # Delete history records for a single group in chunks of 10000
            queryset = self.model.objects.filter(group_id=group_id)
            while True:
                # Get the first 10000 records
                chunk = queryset.order_by("id")[:10000]
                if not chunk.exists():
                    break
                chunk.delete()

        return False
