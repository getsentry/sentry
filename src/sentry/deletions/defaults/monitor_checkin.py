from collections.abc import Sequence

from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.monitors.models import MonitorCheckIn


class MonitorCheckInDeletionTask(ModelDeletionTask[MonitorCheckIn]):
    def get_child_relations_bulk(
        self, instance_list: Sequence[MonitorCheckIn]
    ) -> list[BaseRelation]:
        """
        Return bulk child relations for MonitorCheckIn deletion.

        Uses __in queries to efficiently delete MonitorIncidents that reference these check-ins.
        """
        from sentry.monitors import models

        checkin_ids = [ci.id for ci in instance_list]

        return [
            ModelRelation(
                models.MonitorIncident,
                {"starting_checkin_id__in": checkin_ids},
            ),
            ModelRelation(
                models.MonitorIncident,
                {"resolving_checkin_id__in": checkin_ids},
            ),
        ]
