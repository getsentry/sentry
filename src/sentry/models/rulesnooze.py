from django.db import models
from django.db.models import CheckConstraint, Q

from sentry.db.models import FlexibleForeignKey, Model, region_silo_only_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@region_silo_only_model
class RuleSnooze(Model):
    """
    Duration an issue alert or metric alert is snoozed for a user. Null `until` value means snoozed forever.
    """

    __include_in_export__ = True

    user_id = HybridCloudForeignKey("sentry.User", unique=True, on_delete="CASCADE")
    rule = FlexibleForeignKey("sentry.Rule", null=True, unique=True)
    alert_rule = FlexibleForeignKey("sentry.AlertRule", null=True)
    until = models.DateTimeField(null=True, db_index=True)

    class Meta:
        db_table = "sentry_rulesnooze"
        app_label = "sentry"
        unique_together = (("user_id", "rule"), ("user_id", "alert_rule"))
        constraints = [
            CheckConstraint(
                check=Q(rule__isnull=False, alert_rule__isnull=True)
                | Q(rule__isnull=True, alert_rule__isnull=False),
                name="rule_or_alert_rule",
            )
        ]

    __repr__ = sane_repr("user_id", "rule_id", "alert_rule_id", "until")
