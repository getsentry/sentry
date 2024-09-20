from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.discover.models import DiscoverSavedQuery


class DiscoverSavedQueryDeletionTask(ModelDeletionTask[DiscoverSavedQuery]):
    def get_child_relations(self, instance: DiscoverSavedQuery) -> list[BaseRelation]:
        from sentry.discover.models import DiscoverSavedQueryProject

        return [
            ModelRelation(DiscoverSavedQueryProject, {"discover_saved_query_id": instance.id}),
        ]
