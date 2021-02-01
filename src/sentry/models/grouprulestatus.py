from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, sane_repr


class GroupRuleStatus(Model):
    __core__ = False

    ACTIVE = 0
    INACTIVE = 1

    project = FlexibleForeignKey("sentry.Project")
    rule = FlexibleForeignKey("sentry.Rule")
    group = FlexibleForeignKey("sentry.Group")
    status = models.PositiveSmallIntegerField(default=ACTIVE)
    date_added = models.DateTimeField(default=timezone.now)
    last_active = models.DateTimeField(null=True)

    class Meta:
        db_table = "sentry_grouprulestatus"
        app_label = "sentry"
        unique_together = (("rule", "group"),)

    __repr__ = sane_repr("rule_id", "group_id", "status")
