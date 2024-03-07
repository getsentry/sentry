from __future__ import annotations

import logging
from datetime import datetime

from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, region_silo_only_model
from sentry.incidents.models.alert_rule import AlertRule

logger = logging.getLogger(__name__)


class AlertRuleActivationsManager(models.Manager):
    def get_activations_in_window(self, alert_rule: AlertRule, start: datetime, end: datetime):
        # Return all activations for this alert rule that were activated in the window
        pass


@region_silo_only_model
class AlertRuleActivations(Model):
    """
    This model represents the monitor results for an activated Alert Rule.
    This is no longer a "results" model, but more of a record of activations
    """

    objects = AlertRuleActivationsManager()

    alert_rule = FlexibleForeignKey("sentry.AlertRule", related_name="activation_results")
    # date_added timestamp indicates when this particular run was activated
    date_added = models.DateTimeField(default=timezone.now)
    # If finished_ts is null, this indicates whether the run is ongoing or completed
    finished_ts = models.DateTimeField(null=True)
    metric_value = models.FloatField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertruleactivations"

    def is_complete(self) -> bool:
        # Assert alert_rule.snuba_query exists (activated alert rules MUST have an associated snuba_query)
        # return finished_ts is not None and date_added + alert_rule.snuba_query.time_window < timezone.now()
        pass

    def get_triggers(self):
        # self.alert_rule.alertruletrigger_set.get()
        pass

    def get_window(self):
        # Return start, expected end, and actual end
        # log warning if expected end and actual end are off?
        pass
