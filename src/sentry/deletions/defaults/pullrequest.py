from collections.abc import Sequence
from datetime import datetime, timedelta, timezone

from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.models.pullrequest import PullRequest, PullRequestComment, PullRequestCommit


class PullRequestDeletionTask(ModelDeletionTask[PullRequest]):
    def filter_deletions_bulk(self, instances: Sequence[PullRequest]) -> Sequence[PullRequest]:
        # This could be inefficient for a lot of pull requests, we can attempt to convert this to a bulk
        # function if needed. But this table won't have a high rate of deletions, so this should be ok.
        cutoff = datetime.now(timezone.utc) - timedelta(days=90)
        return [instance for instance in instances if instance.is_unused(cutoff)]

    def get_child_relations(self, instance: PullRequest) -> list[BaseRelation]:
        return [
            ModelRelation(PullRequestComment, {"pull_request_id": instance.id}),
            ModelRelation(PullRequestCommit, {"pull_request_id": instance.id}),
        ]
