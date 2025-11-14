from typing import int
from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction


class AlertRuleTriggerActionDeletionTask(ModelDeletionTask[AlertRuleTriggerAction]):
    manager_name = "objects_for_deletion"

    def get_child_relations(self, instance: AlertRuleTriggerAction) -> list[BaseRelation]:
        from sentry.notifications.models.notificationmessage import NotificationMessage
        from sentry.workflow_engine.models import ActionAlertRuleTriggerAction

        relations: list[BaseRelation] = [
            ModelRelation(NotificationMessage, {"trigger_action_id": instance.id}),
            ModelRelation(
                ActionAlertRuleTriggerAction, {"alert_rule_trigger_action_id": instance.id}
            ),
        ]
        return relations
