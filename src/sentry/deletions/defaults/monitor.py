from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.monitors.models import Monitor


class MonitorDeletionTask(ModelDeletionTask[Monitor]):
    def get_child_relations(self, instance: Monitor) -> list[BaseRelation]:
        from sentry.monitors import models

        return [
            ModelRelation(models.MonitorCheckIn, {"monitor_id": instance.id}, ModelDeletionTask),
            ModelRelation(models.MonitorEnvironment, {"monitor_id": instance.id}),
        ]
