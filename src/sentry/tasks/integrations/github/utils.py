import logging
from dataclasses import dataclass
from enum import Enum

from django.utils import timezone

from sentry import analytics
from sentry.integrations.github.client import GitHubAppsClient
from sentry.models.pullrequest import CommentType, PullRequestComment
from sentry.models.repository import Repository
from sentry.utils import metrics

logger = logging.getLogger(__name__)


@dataclass
class PullRequestIssue:
    title: str
    subtitle: str
    url: str
    affected_users: int | None = None
    event_count: int | None = None
    function_name: str | None = None


@dataclass
class PullRequestFile:
    filename: str
    patch: str


class GithubAPIErrorType(Enum):
    RATE_LIMITED = "gh_rate_limited"
    MISSING_PULL_REQUEST = "missing_gh_pull_request"
    UNKNOWN = "unknown_api_error"


def create_or_update_comment(
    client: GitHubAppsClient,
    repo: Repository,
    pr_key: int,
    comment_body: str,
    pullrequest_id: int,
    issue_list: list[int],
    metrics_base: str,
    comment_type: int = CommentType.MERGED_PR,
    language: str | None = "not found",
):
    pr_comment_query = PullRequestComment.objects.filter(
        pull_request__id=pullrequest_id, comment_type=comment_type
    )
    pr_comment = pr_comment_query[0] if pr_comment_query.exists() else None

    # client will raise ApiError if the request is not successful
    if pr_comment is None:
        resp = client.create_comment(
            repo=repo.name, issue_id=str(pr_key), data={"body": comment_body}
        )

        current_time = timezone.now()
        comment = PullRequestComment.objects.create(
            external_id=resp.body["id"],
            pull_request_id=pullrequest_id,
            created_at=current_time,
            updated_at=current_time,
            group_ids=issue_list,
            comment_type=comment_type,
        )
        metrics.incr(metrics_base.format(key="comment_created"))

        if comment_type == CommentType.OPEN_PR:
            analytics.record(
                "open_pr_comment.created",
                comment_id=comment.id,
                org_id=repo.organization_id,
                pr_id=pullrequest_id,
                language=language,
            )
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
