from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.snuba.models import QuerySubscription


class QuerySubscriptionDeletionTask(ModelDeletionTask[QuerySubscription]):
    def delete_instance(self, instance: QuerySubscription) -> None:
        from sentry.incidents.models.incident import Incident

        # Clear the foreign key as the schema was created without a cascade clause
        Incident.objects.filter(subscription_id=instance.id).update(subscription_id=None)
        super().delete_instance(instance)

    def get_child_relations(self, instance: QuerySubscription) -> list[BaseRelation]:
        from sentry.incidents.models.alert_rule import AlertRule
        from sentry.snuba.models import SnubaQuery

        if not AlertRule.objects.filter(snuba_query_id=instance.snuba_query_id).exists():
            if (
                QuerySubscription.objects.filter(snuba_query_id=instance.snuba_query_id).count()
                == 1
            ):
                return [ModelRelation(SnubaQuery, {"id": instance.snuba_query_id})]

        return []
