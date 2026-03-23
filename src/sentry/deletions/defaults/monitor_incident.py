from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.monitors.models import MonitorIncident


class MonitorIncidentDeletionTask(ModelDeletionTask[MonitorIncident]):
    def get_child_relations(self, instance: MonitorIncident) -> list[BaseRelation]:
        from sentry.monitors import models

        return [
            ModelRelation(
                models.MonitorEnvBrokenDetection,
                {"monitor_incident_id": instance.id},
            ),
        ]
