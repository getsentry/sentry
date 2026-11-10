from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.snuba.models import QuerySubscription


class QuerySubscriptionDeletionTask(ModelDeletionTask[QuerySubscription]):
    def get_child_relations(self, instance: QuerySubscription) -> list[BaseRelation]:
        from sentry.incidents.models.alert_rule import AlertRule
        from sentry.snuba.models import SnubaQuery

        if not AlertRule.objects_with_snapshots.filter(
            snuba_query_id=instance.snuba_query_id
        ).exists():
            if (
                QuerySubscription.objects.filter(snuba_query_id=instance.snuba_query_id).count()
                == 1
            ):
                return [ModelRelation(SnubaQuery, {"id": instance.snuba_query_id})]

        return []
