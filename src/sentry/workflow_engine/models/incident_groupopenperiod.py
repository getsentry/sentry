from django.db.models import UniqueConstraint

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    DefaultFieldsModel,
    FlexibleForeignKey,
    region_silo_model,
)


@region_silo_model
class IncidentGroupOpenPeriod(DefaultFieldsModel):
    """
    A lookup model for incidents and group open periods.
    """

    __relocation_scope__ = RelocationScope.Global

    incident_id = BoundedBigIntegerField(null=True)
    group_open_period = FlexibleForeignKey("sentry.GroupOpenPeriod")

    class Meta:
        db_table = "workflow_engine_incidentgroupopenperiod"
        app_label = "workflow_engine"

        constraints = [
            UniqueConstraint(
                fields=["incident_id", "group_open_period"],
                name="workflow_engine_uniq_incident_groupopenperiod",
            )
        ]
