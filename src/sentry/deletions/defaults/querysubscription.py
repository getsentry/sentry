from django.db import router, transaction

from sentry.deletions.base import ModelDeletionTask
from sentry.snuba.models import QuerySubscription


class QuerySubscriptionDeletionTask(ModelDeletionTask[QuerySubscription]):
    def delete_instance(self, instance: QuerySubscription) -> None:
        from sentry.incidents.models.alert_rule import AlertRule
        from sentry.snuba.models import SnubaQuery

        with transaction.atomic(using=router.db_for_write(SnubaQuery)):
            # Serialize the last-subscription check when several subscriptions share a query.
            query = SnubaQuery.objects.select_for_update().get_or_none(id=instance.snuba_query_id)
            super().delete_instance(instance)
            if (
                query is not None
                and not query.subscriptions.exists()
                and not AlertRule.objects_with_snapshots.filter(snuba_query_id=query.id).exists()
            ):
                query.delete()
