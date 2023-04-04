from django.db import models

from sentry.db.models import FlexibleForeignKey, Model, region_silo_only_model, sane_repr


@region_silo_only_model
class RuleSnooze(Model):
    """
    Whether or not an issue alert or metric alert is snoozed for a user and optionally for how long.
    """

    __include_in_export__ = True

    user = FlexibleForeignKey("sentry.User")
    rule = FlexibleForeignKey("sentry.Rule", null=True)
    alert_rule = FlexibleForeignKey("sentry.AlertRule", null=True)
    muted = models.BooleanField(default=True)
    until = models.DateTimeField(null=True)

    class Meta:
        db_table = "sentry_rulesnooze"
        app_label = "sentry"

    __repr__ = sane_repr("user_id", "rule_id", "alert_rule_id", "muted", "until")
