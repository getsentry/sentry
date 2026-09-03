from sentry.deletions.base import (
    BaseRelation,
    ModelDeletionTask,
    ModelRelation,
)
from sentry.monitors.models import MonitorEnvironment


class MonitorEnvironmentDeletionTask(ModelDeletionTask[MonitorEnvironment]):
    def get_child_relations(self, instance: MonitorEnvironment) -> list[BaseRelation]:
        from sentry.monitors import models

        return [
            ModelRelation(
                models.MonitorIncident,
                {"monitor_environment_id": instance.id},
            ),
            ModelRelation(
                models.MonitorCheckIn,
                {"monitor_environment_id": instance.id},
                ModelDeletionTask,
                # Skip marking as in progress for deletion since this can be a high volume delete
                mark_in_progress=False,
                # Rate limit check-in deletions so a large delete doesn't spike DB load
                rate_limit_option="deletions.monitor-check-in.rate-limit",
            ),
        ]
