import logging
from dataclasses import dataclass
from typing import List, Optional

from django.utils import timezone

from sentry.integrations.github.client import GitHubAppsClient
from sentry.models.pullrequest import CommentType, PullRequestComment
from sentry.models.repository import Repository
from sentry.tasks.integrations.github.constants import MERGED_PR_METRICS_BASE
from sentry.utils import metrics

logger = logging.getLogger(__name__)


@dataclass
class PullRequestIssue:
    title: str
    subtitle: str
    url: str
    affected_users: Optional[int] = None
    event_count: Optional[int] = None
    function_name: Optional[str] = None


@dataclass
class PullRequestFile:
    filename: str
    patch: str


def create_or_update_comment(
    pr_comment: PullRequestComment | None,
    client: GitHubAppsClient,
    repo: Repository,
    pr_key: int,
    comment_body: str,
    pullrequest_id: int,
    issue_list: List[int],
    comment_type: int = CommentType.MERGED_PR,
    metrics_base=MERGED_PR_METRICS_BASE,
):
    # client will raise ApiError if the request is not successful
    if pr_comment is None:
        resp = client.create_comment(
            repo=repo.name, issue_id=str(pr_key), data={"body": comment_body}
        )

        current_time = timezone.now()
        PullRequestComment.objects.create(
            external_id=resp.body["id"],
            pull_request_id=pullrequest_id,
            created_at=current_time,
            updated_at=current_time,
            group_ids=issue_list,
            comment_type=comment_type,
        )
        metrics.incr(metrics_base.format(key="comment_created"))
    else:
        resp = client.update_comment(
            repo=repo.name, comment_id=pr_comment.external_id, data={"body": comment_body}
        )
        metrics.incr(metrics_base.format(key="comment_updated"))
        pr_comment.updated_at = timezone.now()
        pr_comment.group_ids = issue_list
        pr_comment.save()

    # TODO(cathy): Figure out a way to track average rate limit left for GH client

    logger_event = metrics_base.format(key="create_or_update_comment")
    logger.info(
        logger_event,
        extra={"new_comment": pr_comment is None, "pr_key": pr_key, "repo": repo.name},
    )
