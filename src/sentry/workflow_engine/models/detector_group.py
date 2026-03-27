from typing import ClassVar, Self

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, cell_silo_model
from sentry.models.activity import BaseManager


@cell_silo_model
class DetectorGroup(DefaultFieldsModel):
    """
    A model to represent the relationship between a detector and a group.
    """

    __relocation_scope__ = RelocationScope.Excluded

    detector = FlexibleForeignKey("workflow_engine.Detector", null=True, on_delete=models.SET_NULL)
    group = FlexibleForeignKey("sentry.Group", on_delete=models.CASCADE)

    objects: ClassVar[BaseManager[Self]] = BaseManager(cache_fields=("pk", "group"))

    class Meta:
        db_table = "workflow_engine_detectorgroup"
        app_label = "workflow_engine"
        indexes = [
            models.Index(fields=["detector", "-date_added"], name="detectorgroup_det_date_idx"),
        ]
        unique_together = ("group",)
