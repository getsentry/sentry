from sentry.deletions.base import ModelDeletionTask, ModelRelation


class RemoteSubscriptionDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.uptime.models import UptimeSubscription

        return [
            ModelRelation(UptimeSubscription, {"remote_subscription_id": instance.id}),
        ]
