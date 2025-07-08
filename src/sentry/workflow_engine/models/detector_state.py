from django.db import models
from django.db.models import F, Value
from django.db.models.functions import Coalesce

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model
from sentry.workflow_engine.types import DetectorPriorityLevel


@region_silo_model
class DetectorState(DefaultFieldsModel):
    """
    This table can be seen as a denormalization of the latest open period state
    of the issue associated to a detector. We need this because open-periods
    are asynchronously created and there are scernios where we need to know the
    detector state immediately after a state change.
    """

    __relocation_scope__ = RelocationScope.Excluded

    detector = FlexibleForeignKey("workflow_engine.Detector")

    # This key is used when a detector is using group-by
    # allows us to link to a specific group from a single detector
    detector_group_key = models.CharField(max_length=200, blank=True, null=True)

    # If the detector has met the conditions to be in an triggered state
    is_triggered = models.BooleanField(default=False, db_column="active")

    # The detectors priority level from the last detector evaluation
    state = models.CharField(max_length=200, default=DetectorPriorityLevel.OK)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                F("detector"),
                Coalesce("detector_group_key", Value("")),
                name="detector_state_unique_group_key",
            ),
        ]
