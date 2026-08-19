from sentry.deletions.base import (
    BaseRelation,
    BulkModelDeletionTask,
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
            # Use BulkModelDeletionTask here since MonitorIncidents are already handled above.
            # Share the monitor check-in rate limit so concurrent env bulk deletes cannot
            # stampede db-crons with uncapped DELETE sessions.
            ModelRelation(
                models.MonitorCheckIn,
                {"monitor_environment_id": instance.id},
                BulkModelDeletionTask,
                rate_limit_option="deletions.monitor-check-in.rate-limit",
            ),
        ]
