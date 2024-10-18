from enum import StrEnum

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model


class DetectorStatus(StrEnum):
    OK = "ok"


@region_silo_model
class DetectorState(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    detector = FlexibleForeignKey("workflow_engine.Detector")

    # This key is used when a detector is using group-by
    # allows us to link to a specific group from a single detector
    detector_group_key = models.CharField(max_length=200, blank=True, null=True)

    # If the detector is currently active
    active = models.BooleanField(default=False)

    # The current state of the detector
    state = models.CharField(max_length=200, default=DetectorStatus.OK)
