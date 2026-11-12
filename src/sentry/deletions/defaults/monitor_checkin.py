from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.monitors.models import MonitorCheckIn


class MonitorCheckInDeletionTask(ModelDeletionTask[MonitorCheckIn]):
    mark_in_progress_default = False
    # Rate limit check-in deletions so a large delete doesn't spike DB load
    rate_limit_option_default = "deletions.monitor-check-in.rate-limit"

    def get_child_relations(self, instance: MonitorCheckIn) -> list[BaseRelation]:
        from sentry.monitors import models

        # When MonitorCheckIn is deleted directly, we need to delete MonitorIncidents
        # that reference it. MonitorIncident has two FKs pointing to MonitorCheckIn.
        return [
            ModelRelation(
                models.MonitorIncident,
                {"starting_checkin_id": instance.id},
            ),
            ModelRelation(
                models.MonitorIncident,
                {"resolving_checkin_id": instance.id},
            ),
        ]
