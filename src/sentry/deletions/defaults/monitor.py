from ..base import BulkModelDeletionTask, ModelDeletionTask, ModelRelation


class MonitorDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.monitors import models

        return [
            ModelRelation(
                models.MonitorCheckIn, {"monitor_id": instance.id}, BulkModelDeletionTask
            ),
            ModelRelation(models.MonitorEnvironment, {"monitor_id": instance.id}),
        ]
