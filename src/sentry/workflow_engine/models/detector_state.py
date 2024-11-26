from django.db import models
from django.db.models import F, Value
from django.db.models.functions import Coalesce

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model
from sentry.workflow_engine.types import DetectorPriorityLevel


@region_silo_model
class DetectorState(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    detector = FlexibleForeignKey("workflow_engine.Detector")

    # This key is used when a detector is using group-by
    # allows us to link to a specific group from a single detector
    detector_group_key = models.CharField(max_length=200, blank=True, null=True)

    # If the detector is currently active
    active = models.BooleanField(default=False)

    # The current state of the detector
    state = models.CharField(max_length=200, default=DetectorPriorityLevel.OK)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                F("detector"),
                Coalesce("detector_group_key", Value("")),
                name="detector_state_unique_group_key",
            ),
        ]
