from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model


@region_silo_model
class ActionAlertRuleTriggerAction(DefaultFieldsModel):
    """
    A lookup model for Actions (new) and AlertRuleTriggerActions (legacy)
    """

    __relocation_scope__ = RelocationScope.Organization

    action = FlexibleForeignKey("workflow_engine.Action")
    alert_rule_trigger_action = FlexibleForeignKey("sentry.AlertRuleTriggerAction")
