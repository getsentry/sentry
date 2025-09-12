from collections.abc import Callable

from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.utils.registry import Registry
from sentry.workflow_engine.models.detector import Detector


class DetectorDeletionTask(ModelDeletionTask[Detector]):
    manager_name = "objects_for_deletion"

    def get_child_relations(self, instance: Detector) -> list[BaseRelation]:
        from sentry.workflow_engine.models import DataConditionGroup, DataSource

        model_relations: list[BaseRelation] = []

        # check that no other rows are related to the data source
        data_source_ids = DataSource.objects.filter(detector=instance.id).values_list(
            "id", flat=True
        )
        if data_source_ids:
            # this ensures we're not deleting a data source that's connected to another detector
            if (
                Detector.objects_for_deletion.filter(data_sources__in=[data_source_ids[0]]).count()
                == 1
            ):
                model_relations.append(ModelRelation(DataSource, {"detector": instance.id}))

        if instance.workflow_condition_group:
            model_relations.append(
                ModelRelation(DataConditionGroup, {"id": instance.workflow_condition_group.id})
            )

        try:
            handler = detector_deletion_registry.get(instance.type)
            handler(instance, model_relations)
        except Exception:
            # Something went wrong in the handler, continue?
            return model_relations

        return model_relations


DetectorDeletionHandler = Callable[[Detector, list[BaseRelation]], list[BaseRelation]]
detector_deletion_registry = Registry[DetectorDeletionHandler](enable_reverse_lookup=False)
