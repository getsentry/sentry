from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_only_model
from sentry.db.models.fields.bounded import BoundedPositiveIntegerField
from sentry.models.release_threshold.constants import ReleaseThresholdType
from sentry.models.release_threshold.constants import TriggerType as ReleaseThresholdTriggerType


@region_silo_only_model
class ReleaseThreshold(Model):
    """
    NOTE:
    We've duplicated some of the logic from the AlertRuleTrigger model
    https://github.com/getsentry/sentry/blob/master/src/sentry/incidents/models.py#L578

    AlertRuleTrigger.alert_threshold === threshold value
    AlertRuleTrigger.threshold_type === ReleaseThreshold.trigger_type ('over' or 'under')
    (assumption 0 is over, 1 is under)

    AlertRule === threshold
    SubscriptionQuery === threshold_type (determines what data to query for threshold)

    TODO: dig into alert rule Subscription Consumer
    - Determine how we're subscribed to the query
    - See how we can plug into the subscription to check if an alert rule is active?
        - Maybe when a release is created - we rewrite the temporal alert rules to be active
        - Then after their window period is exhausted, we rewrite it to be inactive?

    We could create a query subscription specifically for alerts/notifications/webhook actions
    """

    __relocation_scope__ = RelocationScope.Excluded

    threshold_type = BoundedPositiveIntegerField(choices=ReleaseThresholdType.as_choices())
    trigger_type = BoundedPositiveIntegerField(choices=ReleaseThresholdTriggerType.as_choices())

    value = models.IntegerField()
    window_in_seconds = models.PositiveIntegerField()

    project = FlexibleForeignKey("sentry.Project", db_index=True, related_name="release_thresholds")
    environment = FlexibleForeignKey("sentry.Environment", null=True, db_index=True)
    date_added = models.DateTimeField(default=timezone.now)
