from ..base import ModelDeletionTask, ModelRelation


class PullRequestDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models.pullrequest import PullRequestComment

        return [
            ModelRelation(PullRequestComment, {"pull_request_id": instance.id}),
        ]
