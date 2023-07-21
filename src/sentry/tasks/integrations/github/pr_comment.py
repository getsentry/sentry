from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List

import sentry_sdk
from django.db import connection
from django.utils import timezone
from snuba_sdk import Column, Condition, Direction, Entity, Function, Op, OrderBy, Query
from snuba_sdk import Request as SnubaRequest

from sentry import features
from sentry.integrations.github.client import GitHubAppsClient
from sentry.models import Group, GroupOwnerType, Project
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequestComment
from sentry.models.repository import Repository
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.shared_integrations.exceptions.base import ApiError
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task
from sentry.tasks.commit_context import DEBOUNCE_PR_COMMENT_CACHE_KEY
from sentry.types.referrer_ids import GITHUB_PR_BOT_REFERRER
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.query import RangeQuerySetWrapper
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

ISSUE_LOCKED_ERROR_MESSAGE = "Unable to create comment because issue is locked."

RATE_LIMITED_MESSAGE = "API rate limit exceeded"


def format_comment(issues: List[PullRequestIssue]):
    def format_subtitle(subtitle):
        return subtitle[:47] + "..." if len(subtitle) > 50 else subtitle

    def format_url(url):
        return url + "?referrer=" + GITHUB_PR_BOT_REFERRER

    issue_list = "\n".join(
        [
            SINGLE_ISSUE_TEMPLATE.format(
                title=issue.title,
                subtitle=format_subtitle(issue.subtitle),
                url=format_url(issue.url),
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
            JOIN sentry_pullrequest_commit c ON c.commit_id = (go.context::jsonb->>'commitId')::int
            JOIN sentry_pull_request pr ON c.pull_request_id = pr.id
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
    return raw_snql_query(request, referrer=Referrer.GITHUB_PR_COMMENT_BOT.value)["data"]


def get_comment_contents(issue_list: List[int]) -> List[PullRequestIssue]:
    """Retrieve the issue information that will be used for comment contents"""
    issues = Group.objects.filter(id__in=issue_list).all()
    return [
        PullRequestIssue(title=issue.title, subtitle=issue.culprit, url=issue.get_absolute_url())
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
        resp = client.update_comment(
            repo=repo.name, comment_id=pr_comment.external_id, data={"body": comment_body}
        )

        pr_comment.updated_at = timezone.now()
        pr_comment.group_ids = issue_list
        pr_comment.save()

    metrics.incr(
        "github_pr_comment.rate_limit_remaining",
        tags={"remaining": int(resp.headers["X-Ratelimit-Remaining"])},
    )

    logger.info(
        "github.pr_comment.create_or_update_comment",
        extra={"new_comment": pr_comment is None, "pr_key": pr_key, "repo": repo.name},
    )


@instrumented_task(name="sentry.tasks.integrations.github_comment_workflow")
def github_comment_workflow(pullrequest_id: int, project_id: int):
    cache_key = DEBOUNCE_PR_COMMENT_CACHE_KEY(pullrequest_id)

    gh_repo_id, pr_key, org_id, issue_list = pr_to_issue_query(pullrequest_id)[0]

    try:
        organization = Organization.objects.get_from_cache(id=org_id)
    except Organization.DoesNotExist:
        cache.delete(cache_key)
        logger.error("github.pr_comment.org_missing")
        metrics.incr("github_pr_comment.error", tags={"type": "missing_org"})
        return

    if not (
        features.has("organizations:pr-comment-bot", organization)
        and OrganizationOption.objects.get_value(
            organization=organization,
            key="sentry:github_pr_bot",
            default=True,
        )
    ):
        logger.error("github.pr_comment.option_missing", extra={"organization_id": org_id})
        return

    pr_comment = None
    pr_comment_query = PullRequestComment.objects.filter(pull_request__id=pullrequest_id)
    if pr_comment_query.exists():
        pr_comment = pr_comment_query[0]

    try:
        project = Project.objects.get_from_cache(id=project_id)
    except Project.DoesNotExist:
        cache.delete(cache_key)
        logger.error("github.pr_comment.project_missing", extra={"organization_id": org_id})
        metrics.incr("github_pr_comment.error", tags={"type": "missing_project"})
        return

    top_5_issues = get_top_5_issues_by_count(issue_list, project)
    top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]
    issue_comment_contents = get_comment_contents(top_5_issue_ids)

    try:
        repo = Repository.objects.get(id=gh_repo_id)
    except Repository.DoesNotExist:
        cache.delete(cache_key)
        logger.error("github.pr_comment.repo_missing", extra={"organization_id": org_id})
        metrics.incr("github_pr_comment.error", tags={"type": "missing_repo"})
        return

    integration = integration_service.get_integration(integration_id=repo.integration_id)
    if not integration:
        cache.delete(cache_key)
        logger.error("github.pr_comment.integration_missing", extra={"organization_id": org_id})
        metrics.incr("github_pr_comment.error", tags={"type": "missing_integration"})
        return

    installation = integration_service.get_installation(
        integration=integration, organization_id=org_id
    )

    # GitHubAppsClient (GithubClientMixin)
    # TODO(cathy): create helper function to fetch client for repo
    client = installation.get_client()

    comment_body = format_comment(issue_comment_contents)
    logger.info("github.pr_comment.comment_body", extra={"body": comment_body})

    top_24_issues = issue_list[:24]  # 24 is the P99 for issues-per-PR

    try:
        create_or_update_comment(
            pr_comment=pr_comment,
            client=client,
            repo=repo,
            pr_key=pr_key,
            comment_body=comment_body,
            pullrequest_id=pullrequest_id,
            issue_list=top_24_issues,
        )
    except ApiError as e:
        cache.delete(cache_key)

        if e.json:
            if ISSUE_LOCKED_ERROR_MESSAGE in e.json.get("message", ""):
                metrics.incr("github_pr_comment.issue_locked_error")
                return

            elif RATE_LIMITED_MESSAGE in e.json.get("message", ""):
                metrics.incr("github_pr_comment.rate_limited_error")
                return

        metrics.incr("github_pr_comment.api_error")
        raise e


@instrumented_task(name="sentry.tasks.integrations.github_comment_reactions")
def github_comment_reactions():
    logger.info("github.pr_comment.reactions_task")

    comments = PullRequestComment.objects.filter(
        created_at__gte=datetime.now(tz=timezone.utc) - timedelta(days=30)
    ).select_related("pull_request")

    for comment in RangeQuerySetWrapper(comments):
        pr = comment.pull_request
        try:
            repo = Repository.objects.get(id=pr.repository_id)
        except Repository.DoesNotExist:
            metrics.incr("github_pr_comment.comment_reactions.missing_repo")
            continue

        integration = integration_service.get_integration(integration_id=repo.integration_id)
        if not integration:
            logger.error(
                "github.pr_comment.comment_reactions.integration_missing",
                extra={"organization_id": pr.organization_id},
            )
            metrics.incr("github_pr_comment.comment_reactions.missing_integration")
            return

        installation = integration_service.get_installation(
            integration=integration, organization_id=pr.organization_id
        )

        # GitHubAppsClient (GithubClientMixin)
        # TODO(cathy): create helper function to fetch client for repo
        client = installation.get_client()

        try:
            reactions = client.get_comment_reactions(repo=repo.name, comment_id=comment.external_id)

            comment.reactions = reactions
            comment.save()
        except ApiError as e:
            if e.json and RATE_LIMITED_MESSAGE in e.json.get("message", ""):
                metrics.incr("github_pr_comment.comment_reactions.rate_limited_error")
                break

            if e.code == 404:
                metrics.incr("github_pr_comment.comment_reactions.not_found_error")
            else:
                metrics.incr("github_pr_comment.comment_reactions.api_error")
                sentry_sdk.capture_exception(e)
            continue

        metrics.incr("github_pr_comment.comment_reactions.success")
