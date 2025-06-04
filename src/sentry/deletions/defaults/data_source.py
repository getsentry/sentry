from typing import cast

from sentry.deletions.base import BaseRelation, ModelDeletionTask
from sentry.workflow_engine.models.data_source import DataSource


class DataSourceDeletionTask(ModelDeletionTask[DataSource]):
    def get_child_relations(self, instance: DataSource) -> list[BaseRelation]:
        return cast(list[BaseRelation], instance.type_handler.related_model(instance))
