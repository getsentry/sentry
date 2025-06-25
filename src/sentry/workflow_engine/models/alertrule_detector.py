from django.db.models import CheckConstraint, Q, UniqueConstraint

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    DefaultFieldsModel,
    FlexibleForeignKey,
    region_silo_model,
)


@region_silo_model
class AlertRuleDetector(DefaultFieldsModel):
    """
    A lookup model for rules and detectors.
    """

    __relocation_scope__ = RelocationScope.Organization

    alert_rule_id = BoundedBigIntegerField(null=True, db_index=True)
    rule_id = BoundedBigIntegerField(null=True, db_index=True)
    detector = FlexibleForeignKey("workflow_engine.Detector")

    class Meta:
        db_table = "workflow_engine_alertruledetector"
        app_label = "workflow_engine"
        unique_together = (
            ("detector", "rule_id"),
            ("detector", "alert_rule_id"),
        )
        constraints = [
            CheckConstraint(
                condition=Q(rule_id__isnull=False, alert_rule_id__isnull=True)
                | Q(rule_id__isnull=True, alert_rule_id__isnull=False),
                name="rule_or_alert_rule_detector",
            ),
            UniqueConstraint(
                fields=["alert_rule_id"],
                name="workflow_engine_alert_rule_id",
            ),
        ]
