from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.monitors.models import MonitorCheckIn


class MonitorCheckInDeletionTask(ModelDeletionTask[MonitorCheckIn]):
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
