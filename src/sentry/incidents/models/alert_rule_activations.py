from __future__ import annotations

import logging
from datetime import datetime
from typing import TYPE_CHECKING, ClassVar

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_model
from sentry.db.models.manager.base import BaseManager
from sentry.models.releases.constants import DB_VERSION_LENGTH

if TYPE_CHECKING:
    from sentry.incidents.models.alert_rule import AlertRule

logger = logging.getLogger(__name__)


@region_silo_model
class AlertRuleActivationCondition(Model):
    """
    This model represents the activation condition for an activated AlertRule

    label is an optional identifier for an activation condition
    condition_type is AlertRuleActivationConditionType (Release creation / Deploy creation)
    TODO: implement extra query params for advanced conditional rules (eg. +10m after event occurs)
    """

    __relocation_scope__ = RelocationScope.Organization

    alert_rule = FlexibleForeignKey("sentry.AlertRule", related_name="activation_condition")
    label = models.TextField()
    condition_type = models.SmallIntegerField(null=True)

    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertruleactivationcondition"
        unique_together = (("alert_rule", "label"),)


class AlertRuleActivationsManager(BaseManager["AlertRuleActivations"]):
    def get_activations_in_window(self, alert_rule: AlertRule, start: datetime, end: datetime):
        """
        Return all activations for this alert rule that were activated in the window
        """
        return self.filter(alert_rule=alert_rule, date_added__gte=start, date_added__lte=end)


@region_silo_model
class AlertRuleActivations(Model):
    """
    This model represents the record of activations for Alert Rules with monitor_type 'activated'
    """

    __relocation_scope__ = RelocationScope.Excluded

    objects: ClassVar[AlertRuleActivationsManager] = AlertRuleActivationsManager()

    alert_rule = FlexibleForeignKey("sentry.AlertRule", related_name="activations")
    # date_added timestamp indicates when this particular run was activated
    date_added = models.DateTimeField(default=timezone.now)
    # If finished_at is null, this indicates whether the run is ongoing or completed
    finished_at = models.DateTimeField(null=True)
    # metric value represents the query results at the end of the activated time window.
    # since activated alerts are not run on a continuously shifting time window, the value
    # of this metric value will only continually tick upwards until the monitor window has expired.
    metric_value = models.FloatField(null=True)
    # query_subscriptions are cleaned up after every run
    # if a query_subscription is null, finished_at must be NOT be null
    query_subscription = FlexibleForeignKey(
        "sentry.QuerySubscription", null=True, on_delete=models.SET_NULL
    )
    # condition_type is AlertRuleActivationConditionType (Release creation / Deploy creation)
    condition_type = models.SmallIntegerField(default=0)
    # The activator is the identifier for the specific triggered instance (eg. release/deploy version)
    activator = models.CharField(max_length=DB_VERSION_LENGTH, default="default_activator")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertruleactivations"
        indexes = [models.Index(fields=("alert_rule", "date_added"))]

    def is_complete(self) -> bool:
        return bool(self.finished_at)

    def get_triggers(self):
        """
        Alert Rule triggers represent the thresholds required to trigger an activation

        NOTE: AlertRule attr's may change and may not be reliable indicators of incident trigger reasons
        """
        return self.alert_rule.alertruletrigger_set.get()
