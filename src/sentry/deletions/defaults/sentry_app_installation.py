from ..base import ModelDeletionTask, ModelRelation


class SentryAppInstallationDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models import (
            ApiGrant,
            SentryAppInstallationForProvider,
            SentryAppInstallationToken,
            ServiceHook,
        )

        return [
            ModelRelation(ApiGrant, {"id": instance.api_grant_id}),
            ModelRelation(ServiceHook, {"application_id": instance.sentry_app.application_id}),
            ModelRelation(SentryAppInstallationToken, {"sentry_app_installation_id": instance.id}),
            ModelRelation(
                SentryAppInstallationForProvider, {"sentry_app_installation_id": instance.id}
            ),
        ]
