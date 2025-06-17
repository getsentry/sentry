from django.db import models
from django.db.models import Q

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

    __relocation_scope__ = RelocationScope.Excluded

    incident_id = BoundedBigIntegerField(null=True, unique=True)
    incident_identifier = models.IntegerField(null=True)
    group_open_period = FlexibleForeignKey("sentry.GroupOpenPeriod", unique=True)

    class Meta:
        db_table = "workflow_engine_incidentgroupopenperiod"
        app_label = "workflow_engine"
        constraints = [
            models.CheckConstraint(
                condition=Q(incident_identifier__isnull=False) & Q(incident_id__isnull=False)
                | Q(incident_identifier__isnull=True) & Q(incident_id__isnull=True),
                name="inc_id_inc_identifier_together",
            )
        ]
