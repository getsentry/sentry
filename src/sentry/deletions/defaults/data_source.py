from sentry.deletions.base import BaseRelation, ModelDeletionTask
from sentry.workflow_engine.models.data_source import DataSource


class DataSourceDeletionTask(ModelDeletionTask[DataSource]):
    def get_child_relations(self, instance: DataSource) -> list[BaseRelation]:
        return instance.type_handler.related_model(instance)
