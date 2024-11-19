from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.models.rulefirehistory import RuleFireHistory


class RuleFireHistoryDeletionTask(ModelDeletionTask[RuleFireHistory]):
    def get_child_relations(self, instance: RuleFireHistory) -> list[BaseRelation]:
        from sentry.notifications.models.notificationmessage import NotificationMessage

        return [
            ModelRelation(NotificationMessage, {"rule_fire_history_id": instance.id}),
        ]
