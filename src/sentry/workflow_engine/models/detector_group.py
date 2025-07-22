from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model


@region_silo_model
class DetectorGroup(DefaultFieldsModel):
    """
    A model to represent the relationship between a detector and a group.
    """

    __relocation_scope__ = RelocationScope.Excluded

    detector = FlexibleForeignKey("workflow_engine.Detector", on_delete=models.CASCADE)
    group = FlexibleForeignKey("sentry.Group", on_delete=models.CASCADE)

    class Meta:
        db_table = "workflow_engine_detectorgroup"
        app_label = "workflow_engine"
        unique_together = (("detector", "group"),)
