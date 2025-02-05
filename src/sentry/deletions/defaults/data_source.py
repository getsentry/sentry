from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.workflow_engine.models.data_source import DataSource


class DataSourceDeletionTask(ModelDeletionTask[DataSource]):
    def get_child_relations(self, instance: DataSource) -> list[BaseRelation]:
        from sentry.snuba.models import QuerySubscription

        return [ModelRelation(QuerySubscription, {"id": instance.query_id})]
