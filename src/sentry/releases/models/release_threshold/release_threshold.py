from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_model
from sentry.db.models.fields.bounded import BoundedPositiveIntegerField
from sentry.models.release_threshold.constants import ReleaseThresholdType
from sentry.models.release_threshold.constants import TriggerType as ReleaseThresholdTriggerType


@region_silo_model
class ReleaseThreshold(Model):
    """
    NOTE:
    To transition to utilizing AlertRules, there are some duplicated attrs we'll want to dedup.
    AlertRule model should house metadata on the AlertRule itself (eg. type of alert rule)
    AlertRuleTrigger model should house the trigger requirements (eg. value, over/under trigger type)
        - TODO: Will need to determine how this translates to release_threshold evaluation
    QuerySubscription model subscribes the AlertRule to specific query in Snuba
    SnubaQuery model represents the actual query run in Snuba
        - TODO: replace query constructed in release_thresholds api with activated SnubaQuery / determine whether we're constructing the same query or not
    """

    __relocation_scope__ = RelocationScope.Excluded

    threshold_type = BoundedPositiveIntegerField(choices=ReleaseThresholdType.as_choices())
    trigger_type = BoundedPositiveIntegerField(choices=ReleaseThresholdTriggerType.as_choices())

    value = models.IntegerField()
    window_in_seconds = models.PositiveIntegerField()

    project = FlexibleForeignKey("sentry.Project", db_index=True, related_name="release_thresholds")
    environment = FlexibleForeignKey("sentry.Environment", null=True, db_index=True)
    date_added = models.DateTimeField(default=timezone.now)
