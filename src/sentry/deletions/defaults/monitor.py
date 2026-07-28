from sentry.deletions.base import (
    BaseRelation,
    ModelDeletionTask,
    ModelRelation,
)
from sentry.monitors.models import Monitor


class MonitorDeletionTask(ModelDeletionTask[Monitor]):
    def get_child_relations(self, instance: Monitor) -> list[BaseRelation]:
        from sentry.monitors import models

        return [
            ModelRelation(models.MonitorIncident, {"monitor_id": instance.id}),
            ModelRelation(
                models.MonitorCheckIn,
                {"monitor_id": instance.id},
                ModelDeletionTask,
                # Skip marking as in progress for deletion since this can be a high volume delete
                mark_in_progress=False,
                # Rate limit check-in deletions so a large delete doesn't spike DB load
                rate_limit_option="deletions.monitor-check-in.rate-limit",
            ),
            ModelRelation(models.MonitorEnvironment, {"monitor_id": instance.id}),
        ]
