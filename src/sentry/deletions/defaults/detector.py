from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.workflow_engine.models.detector import Detector


class DetectorDeletionTask(ModelDeletionTask[Detector]):
    def get_child_relations(self, instance: Detector) -> list[BaseRelation]:
        from sentry.workflow_engine.models import DataConditionGroup, DataSource

        model_relations = [
            ModelRelation(DataConditionGroup, {"id": instance.workflow_condition_group.id})
        ]

        data_sources = DataSource.objects.filter(detector=instance.id)
        delete = True

        # this doesn't work if a data source is also connected to a different detector that's not being deleted
        for data_source in data_sources:
            for detector in data_source.detectors.all():
                if detector.id != instance.id:
                    delete = False
                    break

        if delete:
            model_relations.append(ModelRelation(DataSource, {"detector": instance.id}))

        return model_relations
