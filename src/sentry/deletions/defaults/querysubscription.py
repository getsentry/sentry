from sentry.deletions.base import ModelDeletionTask
from sentry.snuba.models import QuerySubscription
from sentry.snuba.tasks import delete_query_subscription


class QuerySubscriptionDeletionTask(ModelDeletionTask[QuerySubscription]):
    def delete_instance(self, instance: QuerySubscription) -> None:
        delete_query_subscription(instance)
