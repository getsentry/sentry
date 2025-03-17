from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction


class AlertRuleTriggerActionDeletionTask(ModelDeletionTask[AlertRuleTriggerAction]):
    manager_name = "objects_for_deletion"

    def get_child_relations(self, instance: AlertRuleTriggerAction) -> list[BaseRelation]:
        from sentry.notifications.models.notificationmessage import NotificationMessage

        return [
            ModelRelation(NotificationMessage, {"trigger_action_id": instance.id}),
        ]
