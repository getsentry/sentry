from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.workflow_engine.models.detector import Detector


class DetectorDeletionTask(ModelDeletionTask[Detector]):
    def get_child_relations(self, instance: Detector) -> list[BaseRelation]:
        from sentry.workflow_engine.models import DataConditionGroup, DataSource

        model_relations: list[BaseRelation] = []

        # check that no other rows are related to the data source
        data_source_ids = DataSource.objects.filter(detector=instance.id).values_list(
            "id", flat=True
        )
        if data_source_ids:
            if Detector.objects.filter(data_sources__in=[data_source_ids[0]]).count() == 1:
                model_relations.append(ModelRelation(DataSource, {"detector": instance.id}))

        if instance.workflow_condition_group:
            model_relations.append(
                ModelRelation(DataConditionGroup, {"id": instance.workflow_condition_group.id})
            )

        return model_relations
