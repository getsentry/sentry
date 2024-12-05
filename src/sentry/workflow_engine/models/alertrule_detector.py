from django.db.models import CheckConstraint, Q

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model


@region_silo_model
class AlertRuleDetector(DefaultFieldsModel):
    """
    A lookup model for rules and detectors.
    """

    __relocation_scope__ = RelocationScope.Organization

    alert_rule = FlexibleForeignKey("sentry.AlertRule", null=True)
    rule = FlexibleForeignKey("sentry.Rule", null=True)
    detector = FlexibleForeignKey("workflow_engine.Detector")

    class Meta:
        db_table = "workflow_engine_alertruledetector"
        app_label = "workflow_engine"
        unique_together = (
            ("detector", "rule"),
            ("detector", "alert_rule"),
        )
        constraints = [
            CheckConstraint(
                condition=Q(rule__isnull=False, alert_rule__isnull=True)
                | Q(rule__isnull=True, alert_rule__isnull=False),
                name="rule_or_alert_rule_detector",
            ),
        ]
