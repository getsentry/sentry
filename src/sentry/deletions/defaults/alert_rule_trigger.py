from ..base import ModelDeletionTask, ModelRelation


class AlertRuleTriggerDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.incidents.models.alert_rule import AlertRuleTriggerAction

        return [
            ModelRelation(AlertRuleTriggerAction, {"alert_rule_trigger_id": instance.id}),
        ]
