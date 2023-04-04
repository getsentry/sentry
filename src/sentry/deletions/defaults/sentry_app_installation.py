from ..base import ModelDeletionTask, ModelRelation
from .apigrant import ModelApiGrantDeletionTask


class SentryAppInstallationDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models import (
            ApiGrant,
            SentryAppInstallationForProvider,
            SentryAppInstallationToken,
        )

        return [
            ModelRelation(ApiGrant, {"id": instance.api_grant_id}, task=ModelApiGrantDeletionTask),
            ModelRelation(SentryAppInstallationToken, {"sentry_app_installation_id": instance.id}),
            ModelRelation(
                SentryAppInstallationForProvider, {"sentry_app_installation_id": instance.id}
            ),
        ]

    def mark_deletion_in_progress(self, instance_list):
        pass
