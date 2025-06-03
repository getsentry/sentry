from django.db import models
from django.db.models import CheckConstraint, Q

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    DefaultFieldsModel,
    FlexibleForeignKey,
    region_silo_model,
)


@region_silo_model
class AlertRuleWorkflow(DefaultFieldsModel):
    """
    A lookup model for rules and workflows.
    """

    __relocation_scope__ = RelocationScope.Organization

    alert_rule_id = BoundedBigIntegerField(null=True, db_index=True)
    rule_id = BoundedBigIntegerField(null=True, db_index=True)
    workflow = FlexibleForeignKey("workflow_engine.Workflow")

    class Meta:
        db_table = "workflow_engine_alertruleworkflow"
        app_label = "workflow_engine"
        unique_together = (
            ("workflow", "rule_id"),
            ("workflow", "alert_rule_id"),
        )
        constraints = [
            CheckConstraint(
                condition=Q(rule_id__isnull=False, alert_rule_id__isnull=True)
                | Q(rule_id__isnull=True, alert_rule_id__isnull=False),
                name="rule_or_alert_rule_workflow",
            ),
        ]
        indexes = [
            models.Index(
                fields=["rule_id"],
                name="idx_arw_rule_id",
            ),
            models.Index(
                fields=["alert_rule_id"],
                name="idx_arw_alert_rule_id",
            ),
        ]
