from sentry.deletions.base import ModelDeletionTask
from sentry.uptime.models import UptimeSubscription


class UptimeSubscriptionDeletionTask(ModelDeletionTask[UptimeSubscription]):
    def delete_instance(self, instance: UptimeSubscription) -> None:
        from sentry import quotas
        from sentry.constants import DataCategory
        from sentry.uptime.models import get_detector
        from sentry.uptime.subscriptions.subscriptions import delete_uptime_subscription

        detector = get_detector(instance)

        # XXX: Typically quota updates would be handled by the
        # delete_uptime_detector function exposed in the
        # uptime.subscriptions.subscriptions module. However if a Detector is
        # deleted without using this, we need to still ensure the billing east
        # is revoked.
        #
        # Since the delete_uptime_detector function is already scheduling the
        # detector for deletion, you may think we could remove the quota
        # remove_seat call there, since it will happen here. But this would
        # mean the customers quota is not freed up _immediately_ when the
        # detector is deleted using that method.

        # TODO(epurkhiser): It's very likely the new Workflow Engine detector
        # APIs will NOT free up customers seats immediately. We'll probably
        # need some other hook for this

        # Ensure the billing seat for the parent detector is removed
        quotas.backend.remove_seat(DataCategory.UPTIME, detector)

        # Ensure the remote subscription is also removed
        delete_uptime_subscription(instance)
