from typing import ClassVar

from django.db import models
from django.db.models import CheckConstraint, Q, UniqueConstraint
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BaseManager,
    FlexibleForeignKey,
    Model,
    region_silo_only_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


class RuleSnoozeManager(BaseManager["RuleSnooze"]):
    def is_snoozed_for_all(self, rule=None, alert_rule=None):
        """Check whether the given rule is snoozed for everyone"""
        return RuleSnooze.objects.filter(
            user_id__isnull=True, rule=rule, alert_rule=alert_rule
        ).exists()

    def is_snoozed_for_user(self, user_id, rule=None, alert_rule=None):
        """Check whether the given rule is snoozed for the given user"""
        return RuleSnooze.objects.filter(user_id=user_id, rule=rule, alert_rule=alert_rule).exists()


@region_silo_only_model
class RuleSnooze(Model):
    """
    Duration an issue alert or metric alert is snoozed for a user.
    Null `until` value means snoozed forever.
    Null `user_id` value means snoozed for all users.
    """

    __relocation_scope__ = RelocationScope.Organization

    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE", null=True)
    owner_id = HybridCloudForeignKey("sentry.User", on_delete="SET_NULL", null=True)
    rule = FlexibleForeignKey("sentry.Rule", null=True)
    alert_rule = FlexibleForeignKey("sentry.AlertRule", null=True)
    until = models.DateTimeField(null=True, db_index=True)
    date_added = models.DateTimeField(default=timezone.now)

    objects: ClassVar[RuleSnoozeManager] = RuleSnoozeManager()

    class Meta:
        db_table = "sentry_rulesnooze"
        app_label = "sentry"
        unique_together = (
            ("user_id", "rule"),
            ("user_id", "alert_rule"),
        )
        constraints = [
            CheckConstraint(
                check=Q(rule__isnull=False, alert_rule__isnull=True)
                | Q(rule__isnull=True, alert_rule__isnull=False),
                name="rule_or_alert_rule",
            ),
            UniqueConstraint(
                fields=["rule"],
                condition=Q(user_id__isnull=True),
                name="unique_rule_user",
            ),
            UniqueConstraint(
                fields=["alert_rule"],
                condition=Q(user_id__isnull=True),
                name="unique_alert_rule_user",
            ),
        ]

    __repr__ = sane_repr("user_id", "owner_id", "rule_id", "alert_rule_id", "until", "date_added")
