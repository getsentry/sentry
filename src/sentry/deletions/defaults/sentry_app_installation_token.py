from ..base import ModelDeletionTask, ModelRelation
from .apitoken import ModelApiTokenDeletionTask


class SentryAppInstallationTokenDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models import ApiToken

        return [
            ModelRelation(ApiToken, {"id": instance.api_token_id}, task=ModelApiTokenDeletionTask),
        ]

    def mark_deletion_in_progress(self, instance_list):
        pass
