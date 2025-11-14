from typing import int
from datetime import datetime, timedelta, timezone

from django.db.models import Q

from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.models.pullrequest import PullRequest, PullRequestComment, PullRequestCommit


class PullRequestDeletionTask(ModelDeletionTask[PullRequest]):
    def get_query_filter(self) -> Q:
        """
        Returns a Q object that filters for unused PRs.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=90)
        return PullRequest.get_unused_filter(cutoff)

    def get_child_relations(self, instance: PullRequest) -> list[BaseRelation]:
        return [
            ModelRelation(PullRequestComment, {"pull_request_id": instance.id}),
            ModelRelation(PullRequestCommit, {"pull_request_id": instance.id}),
        ]
