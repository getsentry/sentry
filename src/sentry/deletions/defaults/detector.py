import logging

from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.workflow_engine.models.detector import Detector

logger = logging.getLogger(__name__)


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

        return model_relations

    def delete_instance(self, instance: Detector) -> None:
        from sentry.uptime.subscriptions.subscriptions import remove_uptime_seat
        from sentry.uptime.types import GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE

        if instance.type == GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE:
            try:
                remove_uptime_seat(instance)
            except Exception:
                logger.warning(
                    "detector.deletion.remove_uptime_seat_failed",
                    extra={"detector_id": instance.id},
                    exc_info=True,
                )

        super().delete_instance(instance)
