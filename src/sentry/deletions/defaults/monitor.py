from sentry.deletions.base import (
    BaseRelation,
    BulkModelDeletionTask,
    ModelDeletionTask,
    ModelRelation,
)
from sentry.monitors.models import Monitor


class MonitorDeletionTask(ModelDeletionTask[Monitor]):
    def get_child_relations(self, instance: Monitor) -> list[BaseRelation]:
        from sentry.monitors import models

        return [
            ModelRelation(models.MonitorIncident, {"monitor_id": instance.id}),
            # Use BulkModelDeletionTask here since MonitorIncidents are already handled above
            ModelRelation(
                models.MonitorCheckIn, {"monitor_id": instance.id}, BulkModelDeletionTask
            ),
            ModelRelation(models.MonitorEnvironment, {"monitor_id": instance.id}),
        ]
