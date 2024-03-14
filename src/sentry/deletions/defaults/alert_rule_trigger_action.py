from ..base import ModelDeletionTask, ModelRelation


class AlertRuleTriggerActionDeletionTask(ModelDeletionTask):
    manager_name = "objects_for_deletion"

    def get_child_relations(self, instance):
        from sentry.models.notificationmessage import NotificationMessage

        return [
            ModelRelation(NotificationMessage, {"trigger_action_id": instance.id}),
        ]
