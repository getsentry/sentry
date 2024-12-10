from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.incidents.models.alert_rule import AlertRuleTrigger


class AlertRuleTriggerDeletionTask(ModelDeletionTask[AlertRuleTrigger]):
    def get_child_relations(self, instance: AlertRuleTrigger) -> list[BaseRelation]:
        from sentry.incidents.models.alert_rule import AlertRuleTriggerAction

        return [
            ModelRelation(AlertRuleTriggerAction, {"alert_rule_trigger_id": instance.id}),
        ]
