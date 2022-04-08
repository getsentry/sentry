from ..base import ModelDeletionTask, ModelRelation


class DiscoverSavedQueryDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.discover.models import DiscoverSavedQueryProject

        return [
            ModelRelation(DiscoverSavedQueryProject, {"discover_saved_query_id": instance.id}),
        ]
