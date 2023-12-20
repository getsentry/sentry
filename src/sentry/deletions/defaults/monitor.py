from ..base import ModelDeletionTask, ModelRelation


class MonitorDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.monitors import models

        return [
            ModelRelation(models.MonitorCheckIn, {"monitor_id": instance.id}, ModelDeletionTask),
            ModelRelation(models.MonitorEnvironment, {"monitor_id": instance.id}),
        ]
