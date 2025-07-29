from sentry.deletions.base import ModelDeletionTask
from sentry.uptime.models import ProjectUptimeSubscription, UptimeSubscription


class UptimeSubscriptionDeletionTask(ModelDeletionTask[UptimeSubscription]):
    def delete_instance(self, instance: UptimeSubscription) -> None:
        from sentry.uptime.subscriptions.subscriptions import delete_project_uptime_subscription

        uptime_monitor = ProjectUptimeSubscription.objects.get(uptime_subscription_id=instance.id)
        delete_project_uptime_subscription(uptime_monitor)
