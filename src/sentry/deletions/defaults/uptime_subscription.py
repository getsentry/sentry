from sentry.deletions.base import ModelDeletionTask
from sentry.uptime.models import UptimeSubscription, get_detector


class UptimeSubscriptionDeletionTask(ModelDeletionTask[UptimeSubscription]):
    def delete_instance(self, instance: UptimeSubscription) -> None:
        from sentry.uptime.subscriptions.subscriptions import delete_uptime_detector

        delete_uptime_detector(get_detector(instance), delete_detector=False)
