from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.workflow_engine.models.detector import Detector


class DetectorDeletionTask(ModelDeletionTask[Detector]):
    def get_child_relations(self, instance: Detector) -> list[BaseRelation]:
        from sentry.workflow_engine.models import DataConditionGroup

        return [
            ModelRelation(DataConditionGroup, {"id": instance.workflow_condition_group.id}),
        ]
