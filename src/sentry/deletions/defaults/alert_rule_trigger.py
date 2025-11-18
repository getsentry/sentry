from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.incidents.models.alert_rule import AlertRuleTrigger


class AlertRuleTriggerDeletionTask(ModelDeletionTask[AlertRuleTrigger]):
    def get_child_relations(self, instance: AlertRuleTrigger) -> list[BaseRelation]:
        from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
        from sentry.incidents.models.incident import IncidentTrigger
        from sentry.workflow_engine.models import DataConditionAlertRuleTrigger

        return [
            ModelRelation(AlertRuleTriggerAction, {"alert_rule_trigger_id": instance.id}),
            ModelRelation(IncidentTrigger, {"alert_rule_trigger_id": instance.id}),
            ModelRelation(DataConditionAlertRuleTrigger, {"alert_rule_trigger_id": instance.id}),
        ]
