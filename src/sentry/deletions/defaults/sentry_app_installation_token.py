from ..base import ModelDeletionTask, ModelRelation


class SentryAppInstallationTokenDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models import ApiToken

        return [
            ModelRelation(ApiToken, {"id": instance.api_token_id}),
        ]
