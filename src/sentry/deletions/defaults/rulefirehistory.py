from sentry.deletions.base import ModelDeletionTask, ModelRelation


class RuleFireHistoryDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models.notificationmessage import NotificationMessage

        return [
            ModelRelation(NotificationMessage, {"rule_fire_history_id": instance.id}),
        ]
