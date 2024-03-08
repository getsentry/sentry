from __future__ import annotations

import logging
from datetime import datetime
from typing import ClassVar

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_only_model
from sentry.db.models.manager import BaseManager
from sentry.incidents.models.alert_rule import AlertRule

logger = logging.getLogger(__name__)


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
    metric_value = models.FloatField()

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
