from collections.abc import Sequence

from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.deletions.defaults.apitoken import ModelApiTokenDeletionTask
from sentry.sentry_apps.models.sentry_app_installation_token import SentryAppInstallationToken


class SentryAppInstallationTokenDeletionTask(ModelDeletionTask[SentryAppInstallationToken]):
    def get_child_relations(self, instance: SentryAppInstallationToken) -> list[BaseRelation]:
        from sentry.models.apitoken import ApiToken

        return [
            ModelRelation(ApiToken, {"id": instance.api_token_id}, task=ModelApiTokenDeletionTask),
        ]

    def mark_deletion_in_progress(
        self, instance_list: Sequence[SentryAppInstallationToken]
    ) -> None:
        pass
