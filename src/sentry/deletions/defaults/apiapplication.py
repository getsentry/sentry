from sentry.models.apiapplication import ApiApplicationStatus

from ..base import ModelDeletionTask, ModelRelation


class ApiApplicationDeletionTask(ModelDeletionTask):
    def should_proceed(self, instance):
        return instance.status in {
            ApiApplicationStatus.pending_deletion,
            ApiApplicationStatus.deletion_in_progress,
        }

    def get_child_relations(self, instance):
        from sentry.models.apigrant import ApiGrant
        from sentry.models.apitoken import ApiToken

        # in bulk
        model_list = (ApiToken, ApiGrant)
        return [ModelRelation(m, {"application_id": instance.id}) for m in model_list]

    def mark_deletion_in_progress(self, instance_list):
        from sentry.models.apiapplication import ApiApplicationStatus

        for instance in instance_list:
            if instance.status != ApiApplicationStatus.deletion_in_progress:
                instance.update(status=ApiApplicationStatus.deletion_in_progress)
