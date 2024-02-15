from ..base import ModelDeletionTask, ModelRelation


class NotificationMessageDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.incidents.models import AlertRuleTriggerAction

        return [
            ModelRelation(AlertRuleTriggerAction, {"notificationmessage_id": instance.id}),
        ]

    def mark_deletion_in_progress(self, instance_list):
        from sentry.constants import ObjectStatus

        for instance in instance_list:
            if instance.status != ObjectStatus.PENDING_DELETION:
                instance.update(status=ObjectStatus.PENDING_DELETION)
