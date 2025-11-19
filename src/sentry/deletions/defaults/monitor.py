from collections.abc import Sequence

from sentry import quotas
from sentry.constants import DataCategory
from sentry.deletions.base import (
    BaseRelation,
    BulkModelDeletionTask,
    ModelDeletionTask,
    ModelRelation,
)
from sentry.monitors.models import Monitor


class MonitorDeletionTask(ModelDeletionTask[Monitor]):
    def get_child_relations(self, instance: Monitor) -> list[BaseRelation]:
        from sentry.monitors import models

        return [
            ModelRelation(
                models.MonitorCheckIn, {"monitor_id": instance.id}, BulkModelDeletionTask
            ),
            ModelRelation(models.MonitorEnvironment, {"monitor_id": instance.id}),
        ]

    def delete_instance_bulk(self, instance_list: Sequence[Monitor]) -> None:
        if instance_list:
            quotas.backend.remove_seats(DataCategory.MONITOR_SEAT, instance_list)
        super().delete_instance_bulk(instance_list)
