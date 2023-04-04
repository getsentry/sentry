from django.db import models
from django.db.models import CheckConstraint, Q

from sentry.db.models import FlexibleForeignKey, Model, region_silo_only_model, sane_repr


@region_silo_only_model
class RuleSnooze(Model):
    """
    Whether or not an issue alert or metric alert is snoozed for a user and optionally for how long. Null `until` means snoozed forever.
    """

    __include_in_export__ = True

    user = FlexibleForeignKey("sentry.User", unique=True)
    rule = FlexibleForeignKey("sentry.Rule", null=True, unique=True)
    alert_rule = FlexibleForeignKey("sentry.AlertRule", null=True)
    until = models.DateTimeField(null=True)

    class Meta:
        db_table = "sentry_rulesnooze"
        app_label = "sentry"
        constraints = [
            CheckConstraint(
                check=Q(rule__isnull=False, alert_rule__isnull=True)
                | Q(rule__isnull=True, alert_rule__isnull=False),
                name="rule_or_alert_rule",
            )
        ]

    __repr__ = sane_repr("user_id", "rule_id", "alert_rule_id", "until")
