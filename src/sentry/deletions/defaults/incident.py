from typing import int
from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.incidents.models.incident import Incident
from sentry.models.groupopenperiod import GroupOpenPeriod


class IncidentDeletionTask(ModelDeletionTask[Incident]):
    def get_child_relations(self, instance: Incident) -> list[BaseRelation]:
        from sentry.incidents.models.incident import IncidentProject
        from sentry.workflow_engine.models import IncidentGroupOpenPeriod

        model_relations: list[BaseRelation] = [
            ModelRelation(IncidentProject, {"incident": instance}),
        ]

        inc_gop = IncidentGroupOpenPeriod.objects.filter(incident_id=instance.id)

        if inc_gop:
            model_relations.append(
                ModelRelation(IncidentGroupOpenPeriod, {"incident_id": instance.id})
            )
            model_relations.append(
                ModelRelation(
                    GroupOpenPeriod, {"id__in": [igop.group_open_period.id for igop in inc_gop]}
                )
            )
        return model_relations
