from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_only_model
from sentry.db.models.fields.bounded import BoundedPositiveIntegerField
from sentry.models.release_threshold.constants import ReleaseThresholdType
from sentry.models.release_threshold.constants import TriggerType as ReleaseThresholdTriggerType


@region_silo_only_model
class ReleaseThreshold(Model):
    __relocation_scope__ = RelocationScope.Excluded

    threshold_type = BoundedPositiveIntegerField(choices=ReleaseThresholdType.as_choices())
    trigger_type = BoundedPositiveIntegerField(choices=ReleaseThresholdTriggerType.as_choices())

    value = models.IntegerField()
    window_in_seconds = models.PositiveIntegerField()

    project = FlexibleForeignKey("sentry.Project", db_index=True, related_name="release_thresholds")
    environment = FlexibleForeignKey("sentry.Environment", null=True, db_index=True)
    date_added = models.DateTimeField(default=timezone.now)
