from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.models.pullrequest import PullRequest


class PullRequestDeletionTask(ModelDeletionTask[PullRequest]):
    def get_child_relations(self, instance: PullRequest) -> list[BaseRelation]:
        from sentry.models.pullrequest import PullRequestComment

        return [
            ModelRelation(PullRequestComment, {"pull_request_id": instance.id}),
        ]
