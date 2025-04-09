from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.incidents.models.incident import Incident


class IncidentDeletionTask(ModelDeletionTask[Incident]):
    def get_child_relations(self, instance: Incident) -> list[BaseRelation]:
        from sentry.incidents.models.incident import IncidentProject
        from sentry.workflow_engine.models import IncidentGroupOpenPeriod

        return [
            ModelRelation(IncidentGroupOpenPeriod, {"incident_id": instance.id}),
            ModelRelation(IncidentProject, {"incident": instance}),
        ]
