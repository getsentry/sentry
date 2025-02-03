from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.workflow_engine.models.detector import Detector


class DetectorDeletionTask(ModelDeletionTask[Detector]):
    def get_child_relations(self, instance: Detector) -> list[BaseRelation]:
        from sentry.workflow_engine.models import DataConditionGroup, DataSource

        # XXX: this assumes a data source is connected to a single detector. it's not possible in the UI
        # to do anything else today, but if this changes we'll need to add custom conditional deletion logic

        model_relations: list[BaseRelation] = [ModelRelation(DataSource, {"detector": instance.id})]

        if instance.workflow_condition_group:
            model_relations.append(
                ModelRelation(DataConditionGroup, {"id": instance.workflow_condition_group.id})
            )

        return model_relations
