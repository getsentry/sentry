from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.workflow_engine.models.data_source import DataSource


class DataSourceDeletionTask(ModelDeletionTask[DataSource]):
    def get_child_relations(self, instance: DataSource) -> list[BaseRelation]:
        from sentry.incidents.models.alert_rule import AlertRule
        from sentry.snuba.models import QuerySubscription, SnubaQuery

        model_relations: list[BaseRelation] = [
            ModelRelation(QuerySubscription, {"id": instance.query_id})
        ]

        query_sub = QuerySubscription.objects.get(id=instance.query_id)
        if AlertRule.objects.filter(snuba_query=query_sub.snuba_query).count() > 1:
            return model_relations

        model_relations.append(ModelRelation(SnubaQuery, {"id": query_sub.snuba_query.id}))
        return model_relations
