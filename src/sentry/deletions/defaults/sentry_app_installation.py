from collections.abc import Sequence

from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.deletions.defaults.apigrant import ModelApiGrantDeletionTask
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation


class SentryAppInstallationDeletionTask(ModelDeletionTask[SentryAppInstallation]):
    def get_child_relations(self, instance: SentryAppInstallation) -> list[BaseRelation]:
        from sentry.models.apigrant import ApiGrant
        from sentry.sentry_apps.models.sentry_app_installation_for_provider import (
            SentryAppInstallationForProvider,
        )
        from sentry.sentry_apps.models.sentry_app_installation_token import (
            SentryAppInstallationToken,
        )

        return [
            ModelRelation(ApiGrant, {"id": instance.api_grant_id}, task=ModelApiGrantDeletionTask),
            ModelRelation(SentryAppInstallationToken, {"sentry_app_installation_id": instance.id}),
            ModelRelation(
                SentryAppInstallationForProvider, {"sentry_app_installation_id": instance.id}
            ),
        ]

    def mark_deletion_in_progress(self, instance_list: Sequence[SentryAppInstallation]) -> None:
        pass
