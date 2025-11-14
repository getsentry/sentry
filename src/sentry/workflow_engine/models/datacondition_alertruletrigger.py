from typing import int
from django.db.models import UniqueConstraint

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    DefaultFieldsModel,
    FlexibleForeignKey,
    region_silo_model,
)


@region_silo_model
class DataConditionAlertRuleTrigger(DefaultFieldsModel):
    """
    A lookup model for detector trigger data conditions and alert rule triggers.
    """

    __relocation_scope__ = RelocationScope.Organization

    alert_rule_trigger_id = BoundedBigIntegerField(null=True)
    data_condition = FlexibleForeignKey("workflow_engine.DataCondition")

    class Meta:
        db_table = "workflow_engine_dataconditionalertruletrigger"
        app_label = "workflow_engine"

        constraints = [
            UniqueConstraint(
                fields=["alert_rule_trigger_id", "data_condition"],
                name="workflow_engine_uniq_datacondition_alertruletrigger",
            )
        ]
