from ..base import ModelDeletionTask, ModelRelation


class AlertRuleTriggerActionDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models.notificationmessage import NotificationMessage

        return [
            ModelRelation(NotificationMessage, {"trigger_action": instance.id}),
        ]

    def mark_deletion_in_progress(self, instance_list):
        from sentry.constants import ObjectStatus

        for instance in instance_list:
            if instance.status != ObjectStatus.PENDING_DELETION:
                instance.update(status=ObjectStatus.PENDING_DELETION)
