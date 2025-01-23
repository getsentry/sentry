from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model


@region_silo_model
class AlertRuleTriggerDataCondition(DefaultFieldsModel):
    """
    A lookup model for alertruletriggers and dataconditions.
    """

    __relocation_scope__ = RelocationScope.Organization

    alert_rule_trigger = FlexibleForeignKey("sentry.AlertRuleTrigger")
    data_condition = FlexibleForeignKey("workflow_engine.DataCondition")
