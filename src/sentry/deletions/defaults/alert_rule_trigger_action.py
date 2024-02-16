from ..base import ModelDeletionTask, ModelRelation


class AlertRuleTriggerActionDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models.notificationmessage import NotificationMessage

        return [
            ModelRelation(NotificationMessage, {"trigger_action_id": instance.id}),
        ]
