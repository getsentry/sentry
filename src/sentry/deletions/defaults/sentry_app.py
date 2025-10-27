from collections.abc import Sequence

from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.sentry_apps.models.sentry_app import SentryApp


class SentryAppDeletionTask(ModelDeletionTask[SentryApp]):
    def get_child_relations(self, instance: SentryApp) -> list[BaseRelation]:
        from sentry.models.apiapplication import ApiApplication
        from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
        from sentry.users.models.user import User

        return [
            ModelRelation(SentryAppInstallation, {"sentry_app_id": instance.id}),
            ModelRelation(User, {"id": instance.proxy_user_id}),
            ModelRelation(ApiApplication, {"id": instance.application_id}),
        ]

    def mark_deletion_in_progress(self, instance_list: Sequence[SentryApp]) -> None:
        from sentry.constants import SentryAppStatus

        for instance in instance_list:
            status = getattr(instance, "status", None)
            if status not in (SentryAppStatus.DELETION_IN_PROGRESS, None):
                instance.update(status=SentryAppStatus.DELETION_IN_PROGRESS)
