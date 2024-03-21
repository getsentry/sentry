from __future__ import annotations

import logging
from datetime import datetime
from typing import TYPE_CHECKING, ClassVar

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_only_model
from sentry.db.models.manager import BaseManager

if TYPE_CHECKING:
    from sentry.incidents.models.alert_rule import AlertRule

logger = logging.getLogger(__name__)


@region_silo_only_model
class AlertRuleActivationCondition(Model):
    """
    This model represents the activation condition for an activated AlertRule

    label is an optional identifier for an activation condition
    condition_type is AlertRuleActivationConditionType
    TODO: implement extra query params for advanced conditional rules (eg. +10m after event occurs)
    """

    __relocation_scope__ = RelocationScope.Organization

    alert_rule = FlexibleForeignKey("sentry.AlertRule", related_name="activation_conditions")
    label = models.TextField()
    condition_type = models.SmallIntegerField(null=True)

    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertruleactivationcondition"
        unique_together = (("alert_rule", "label"),)


class AlertRuleActivationsManager(BaseManager["AlertRuleActivations"]):
    def get_activations_in_window(self, alert_rule: AlertRule, start: datetime, end: datetime):
        # Return all activations for this alert rule that were activated in the window
        return


@region_silo_only_model
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
    # query_subscriptions are cleaned up after every run, so we keep reference to the ids rather than foreign keying
    query_subscription_id = models.IntegerField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertruleactivations"

    def is_complete(self) -> bool:
        # Assert alert_rule.snuba_query exists (activated alert rules MUST have an associated snuba_query)
        # return finished_at is not None and date_added + alert_rule.snuba_query.time_window < timezone.now()
        return False

    def get_triggers(self):
        # self.alert_rule.alertruletrigger_set.get()
        return

    def get_window(self):
        # Return start, expected end, and actual end
        # log warning if expected end and actual end are off?
        return
