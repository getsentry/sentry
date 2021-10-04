from ..base import ModelDeletionTask, ModelRelation


class DiscoverSavedQueryDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        import logging

        from sentry.discover.models import DiscoverSavedQueryProject

        logging.info("created child relations for discoversavedquery")

        return [
            ModelRelation(DiscoverSavedQueryProject, {"discover_saved_query_id": instance.id}),
        ]
