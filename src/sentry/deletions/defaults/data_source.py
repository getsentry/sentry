from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.workflow_engine.models.data_source import DataSource


class DataSourceDeletionTask(ModelDeletionTask[DataSource]):
    def get_child_relations(self, instance: DataSource) -> list[BaseRelation]:
        from sentry.snuba.models import QuerySubscription, SnubaQuery

        model_relations: list[BaseRelation] = [
            ModelRelation(QuerySubscription, {"id": instance.query_id})
        ]

        query_sub = QuerySubscription.objects.get(id=instance.query_id)
        snuba_query = SnubaQuery.objects.get(id=query_sub.snuba_query.id)
        # if there are more than 1 querysubscriptions for the related snubaquery, don't delete the snubaquery
        if QuerySubscription.objects.filter(snuba_query_id=snuba_query.id).count() == 1:
            model_relations.append(ModelRelation(SnubaQuery, {"id": query_sub.snuba_query.id}))

        return model_relations
