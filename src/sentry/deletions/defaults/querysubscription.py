from sentry.snuba.models import QuerySubscription

from ..base import ModelDeletionTask


class QuerySubscriptionDeletionTask(ModelDeletionTask):
    def delete_instance(self, instance: QuerySubscription) -> None:
        from sentry.incidents.models.incident import Incident

        # Clear the foreign key as the schema was created without a cascade clause
        Incident.objects.filter(subscription_id=instance.id).update(subscription_id=None)
        super().delete_instance(instance)
