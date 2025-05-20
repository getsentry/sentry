from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    DefaultFieldsModel,
    FlexibleForeignKey,
    region_silo_model,
)


@region_silo_model
class ActionAlertRuleTriggerAction(DefaultFieldsModel):
    """
    A lookup model for Actions (new) and AlertRuleTriggerActions (legacy)
    """

    __relocation_scope__ = RelocationScope.Excluded

    alert_rule_trigger_action_id = BoundedBigIntegerField(db_index=True)
    action = FlexibleForeignKey("workflow_engine.Action")
