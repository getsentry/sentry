from sentry.deletions.base import ModelDeletionTask
from sentry.uptime.models import UptimeSubscription, get_detector
from sentry.uptime.subscriptions.subscriptions import delete_uptime_subscription, remove_uptime_seat


class UptimeSubscriptionDeletionTask(ModelDeletionTask[UptimeSubscription]):
    def delete_instance(self, instance: UptimeSubscription) -> None:

        detector = get_detector(instance)

        # XXX: Typically quota updates would be handled by the
        # delete_uptime_detector function exposed in the
        # uptime.subscriptions.subscriptions module. However if a Detector is
        # deleted without using this, we need to still ensure the billing east
        # is revoked. This should never happen.
        #
        # Since the delete_uptime_detector function is already scheduling the
        # detector for deletion, you may think we could remove the quota
        # remove_seat call there, since it will happen here. But this would
        # mean the customers quota is not freed up _immediately_ when the
        # detector is deleted using that method.
        remove_uptime_seat(detector)

        # Ensure the remote subscription is removed if it wasn't already (again
        # it should have been as part of delete_uptime_detector)
        delete_uptime_subscription(instance)
