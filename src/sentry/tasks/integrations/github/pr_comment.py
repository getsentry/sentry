from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List

from django.db import connection
from django.utils import timezone
from snuba_sdk import Column, Condition, Direction, Entity, Function, Op, OrderBy, Query
from snuba_sdk import Request as SnubaRequest

from sentry import features
from sentry.integrations.github.client import GitHubAppsClient
from sentry.models import Group, GroupOwnerType, Project
from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequestComment
from sentry.models.repository import Repository
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.tasks.base import instrumented_task
from sentry.utils.snuba import Dataset, raw_snql_query

logger = logging.getLogger(__name__)


@dataclass
class PullRequestIssue:
    title: str
    subtitle: str
    url: str


COMMENT_BODY_TEMPLATE = """## Suspect Issues
This pull request has been deployed and Sentry has observed the following issues:

{issue_list}

<sub>Did you find this useful? React with a 👍 or 👎</sub>"""

SINGLE_ISSUE_TEMPLATE = "- ‼️ **{title}** `{subtitle}` [View Issue]({url})"


def format_comment(issues: List[PullRequestIssue]):
    def format_subtitle(subtitle):
        return subtitle[:47] + "..." if len(subtitle) > 50 else subtitle

    issue_list = "\n".join(
        [
            SINGLE_ISSUE_TEMPLATE.format(
                title=issue.title, subtitle=format_subtitle(issue.subtitle), url=issue.url
            )
            for issue in issues
        ]
    )

    return COMMENT_BODY_TEMPLATE.format(issue_list=issue_list)


def pr_to_issue_query(pr_id: int):
    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT pr.repository_id repo_id,
                pr.key pr_key,
                pr.organization_id org_id,
                array_agg(go.group_id ORDER BY go.date_added) issues
            FROM sentry_groupowner go
            JOIN sentry_commit c ON c.id = (go.context::jsonb->>'commitId')::int
            JOIN sentry_pull_request pr ON c.key = pr.merge_commit_sha
            WHERE go.type=0
            AND pr.id={pr_id}
            GROUP BY repo_id,
                pr_key,
                org_id
            """,
            [GroupOwnerType.SUSPECT_COMMIT.value],
        )
        return cursor.fetchall()


def get_top_5_issues_by_count(issue_list: List[int], project: Project) -> List[int]:
    """Given a list of issue group ids, return a sublist of the top 5 ordered by event count"""
    request = SnubaRequest(
        dataset=Dataset.Events.value,
        app_id="default",
        tenant_ids={"organization_id": project.organization_id},
        query=(
            Query(Entity("events"))
            .set_select([Column("group_id"), Function("count", [], "event_count")])
            .set_groupby([Column("group_id")])
            .set_where(
                [
                    Condition(Column("project_id"), Op.EQ, project.id),
                    Condition(Column("group_id"), Op.IN, issue_list),
                    Condition(Column("timestamp"), Op.GTE, datetime.now() - timedelta(days=30)),
                    Condition(Column("timestamp"), Op.LT, datetime.now()),
                ]
            )
            .set_orderby([OrderBy(Column("event_count"), Direction.DESC)])
            .set_limit(5)
        ),
    )
    return raw_snql_query(request, referrer="tasks.github_comment")["data"]


def get_comment_contents(issue_list: List[int]) -> List[PullRequestIssue]:
    """Retrieve the issue information that will be used for comment contents"""
    issues = Group.objects.filter(id__in=issue_list).all()
    return [
        PullRequestIssue(title=issue.title, subtitle=issue.message, url=issue.get_absolute_url())
        for issue in issues
    ]


def create_or_update_comment(
    pr_comment: PullRequestComment | None,
    client: GitHubAppsClient,
    repo: Repository,
    pr_key: int,
    comment_body: str,
    pullrequest_id: int,
    issue_list: List[int],
):
    # client will raise ApiError if the request is not successful
    if pr_comment is None:
        resp = client.create_comment(repo=repo.name, issue_id=pr_key, data={"body": comment_body})

        current_time = timezone.now()
        PullRequestComment.objects.create(
            external_id=resp.body["id"],
            pull_request_id=pullrequest_id,
            created_at=current_time,
            updated_at=current_time,
            group_ids=issue_list,
        )
    else:
        client.update_comment(
            repo=repo.name, comment_id=pr_comment.external_id, data={"body": comment_body}
        )

        pr_comment.updated_at = timezone.now()
        pr_comment.group_ids = issue_list
        pr_comment.save()


@instrumented_task(name="sentry.tasks.integrations.github_pr_comments")
def comment_workflow(pullrequest_id: int, project_id: int):
    gh_repo_id, pr_key, org_id, issue_list = pr_to_issue_query(pullrequest_id)[0]

    try:
        organization = Organization.objects.get_from_cache(id=org_id)
    except Organization.DoesNotExist:
        # TODO(cathy): release the cache key even after exceptions
        logger.error("github.pr_comment.org_missing")
        return

    # TODO(cathy): add check for OrganizationOption for comment bot
    if not features.has("organizations:pr-comment-bot", organization):
        return

    pr_comment = None
    pr_comment_query = PullRequestComment.objects.filter(pull_request__id=pullrequest_id)
    if pr_comment_query.exists():
        pr_comment = pr_comment_query[0]

    try:
        project = Project.objects.get_from_cache(id=project_id)
    except Project.DoesNotExist:
        logger.error("github.pr_comment.project_missing", extra={"organization_id": org_id})
        return

    top_5_issues = get_top_5_issues_by_count(issue_list, project)
    top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]
    issue_comment_contents = get_comment_contents(top_5_issue_ids)

    try:
        repo = Repository.objects.get(id=gh_repo_id)
    except Repository.DoesNotExist:
        logger.error("github.pr_comment.repo_missing", extra={"organization_id": org_id})
        return

    integration = integration_service.get_integration(integration_id=repo.integration_id)
    if not integration:
        logger.error("github.pr_comment.integration_missing", extra={"organization_id": org_id})
        return

    installation = integration_service.get_installation(
        integration=integration, organization_id=org_id
    )

    # GitHubAppsClient (GithubClientMixin)
    # TODO(cathy): create helper function to fetch client for repo
    client = installation.get_client()

    comment_body = format_comment(issue_comment_contents)

    top_24_issues = issue_list[:24]  # 24 is the P99 for issues-per-PR
    create_or_update_comment(
        pr_comment=pr_comment,
        client=client,
        repo=repo,
        pr_key=pr_key,
        comment_body=comment_body,
        pullrequest_id=pullrequest_id,
        issue_list=top_24_issues,
    )
