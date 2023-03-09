from ..base import ModelDeletionTask, ModelRelation


class SentryAppDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models import ApiApplication, SentryAppInstallation, User

        return [
            ModelRelation(ApiApplication, {"id": instance.application_id}),
            ModelRelation(SentryAppInstallation, {"sentry_app_id": instance.id}),
            ModelRelation(User, {"id": instance.proxy_user_id}),
        ]
