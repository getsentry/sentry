from django.db import models

from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    GzippedDictField,
    Model,
    region_silo_only_model,
    sane_repr,
)

@region_silo_only_model
class RuleMuted(Model):
    __include_in_export__ = True

    user = FlexibleForeignKey("sentry.User")
    rule = FlexibleForeignKey("sentry.Rule", null=True)
    alert_rule = FlexibleForeignKey("sentry.AlertRule", null=True)
    muted = models.BooleanField(default=False)
    ignore_duration = models.IntegerField(null=True)

    class Meta:
        db_table = "sentry_rulemuted"
        app_label = "sentry"
        # index_together = (("project", "status", "owner"),)

    __repr__ = sane_repr("user_id", "rule_id", "alert_rule_id", "muted")