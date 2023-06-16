from ..base import ModelDeletionTask, ModelRelation


class SentryAppDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models import ApiApplication, SentryAppInstallation, User

        return [
            ModelRelation(SentryAppInstallation, {"sentry_app_id": instance.id}),
            ModelRelation(User, {"id": instance.proxy_user_id}),
            ModelRelation(ApiApplication, {"id": instance.application_id}),
        ]

    def mark_deletion_in_progress(self, instance_list):
        from sentry.constants import SentryAppStatus

        for instance in instance_list:
            status = getattr(instance, "status", None)
            if status not in (SentryAppStatus.DELETION_IN_PROGRESS, None):
                instance.update(status=SentryAppStatus.DELETION_IN_PROGRESS)
