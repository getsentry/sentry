from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import sentry_sdk
from django.db import connection
from snuba_sdk import Column, Condition, Direction, Entity, Function, Op, OrderBy, Query
from snuba_sdk import Request as SnubaRequest

from sentry import features
from sentry.constants import ObjectStatus
from sentry.integrations.github.constants import ISSUE_LOCKED_ERROR_MESSAGE, RATE_LIMITED_MESSAGE
from sentry.integrations.github.tasks.utils import PullRequestIssue
from sentry.integrations.services.integration import integration_service
from sentry.integrations.source_code_management.commit_context import CommitContextIntegration
from sentry.models.group import Group
from sentry.models.groupowner import GroupOwnerType
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.pullrequest import PullRequestComment
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task
from sentry.tasks.commit_context import DEBOUNCE_PR_COMMENT_CACHE_KEY
from sentry.types.referrer_ids import GITHUB_PR_BOT_REFERRER
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.query import RangeQuerySetWrapper
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)

MERGED_PR_METRICS_BASE = "{integration}.pr_comment.{key}"

MERGED_PR_COMMENT_BODY_TEMPLATE = """\
## Suspect Issues
This pull request was deployed and Sentry observed the following issues:

{issue_list}

<sub>Did you find this useful? React with a 👍 or 👎</sub>"""

MERGED_PR_SINGLE_ISSUE_TEMPLATE = "- ‼️ **{title}** `{subtitle}` [View Issue]({url})"

MAX_SUSPECT_COMMITS = 1000


def format_comment_subtitle(subtitle):
    return subtitle[:47] + "..." if len(subtitle) > 50 else subtitle


def format_comment_url(url, referrer):
    return url + "?referrer=" + referrer


def format_comment(issues: list[PullRequestIssue]):
    issue_list = "\n".join(
        [
            MERGED_PR_SINGLE_ISSUE_TEMPLATE.format(
                title=issue.title,
                subtitle=format_comment_subtitle(issue.subtitle),
                url=format_comment_url(issue.url, GITHUB_PR_BOT_REFERRER),
            )
            for issue in issues
        ]
    )

    return MERGED_PR_COMMENT_BODY_TEMPLATE.format(issue_list=issue_list)


def pr_to_issue_query(pr_id: int):
    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT pr.repository_id repo_id,
                pr.key pr_key,
                pr.organization_id org_id,
                array_agg(go.group_id ORDER BY go.date_added) issues
            FROM sentry_groupowner go
            JOIN sentry_pullrequest_commit c ON c.commit_id = (go.context::jsonb->>'commitId')::bigint
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


def get_top_5_issues_by_count(issue_list: list[int], project: Project) -> list[dict[str, Any]]:
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
                    Condition(Column("level"), Op.NEQ, "info"),
                ]
            )
            .set_orderby([OrderBy(Column("event_count"), Direction.DESC)])
            .set_limit(5)
        ),
    )
    return raw_snql_query(request, referrer=Referrer.GITHUB_PR_COMMENT_BOT.value)["data"]


def get_comment_contents(issue_list: list[int]) -> list[PullRequestIssue]:
    """Retrieve the issue information that will be used for comment contents"""
    issues = Group.objects.filter(id__in=issue_list).order_by("id").all()
    return [
        PullRequestIssue(title=issue.title, subtitle=issue.culprit, url=issue.get_absolute_url())
        for issue in issues
    ]


@instrumented_task(
    name="sentry.integrations.github.tasks.github_comment_workflow", silo_mode=SiloMode.REGION
)
def github_comment_workflow(pullrequest_id: int, project_id: int):
    cache_key = DEBOUNCE_PR_COMMENT_CACHE_KEY(pullrequest_id)

    gh_repo_id, pr_key, org_id, issue_list = pr_to_issue_query(pullrequest_id)[0]

    # cap to 1000 issues in which the merge commit is the suspect commit
    issue_list = issue_list[:MAX_SUSPECT_COMMITS]

    try:
        organization = Organization.objects.get_from_cache(id=org_id)
    except Organization.DoesNotExist:
        cache.delete(cache_key)
        logger.info("github.pr_comment.org_missing")
        metrics.incr(
            MERGED_PR_METRICS_BASE.format(integration="github", key="error"),
            tags={"type": "missing_org"},
        )
        return

    if not OrganizationOption.objects.get_value(
        organization=organization,
        key="sentry:github_pr_bot",
        default=True,
    ):
        logger.info("github.pr_comment.option_missing", extra={"organization_id": org_id})
        return

    try:
        project = Project.objects.get_from_cache(id=project_id)
    except Project.DoesNotExist:
        cache.delete(cache_key)
        logger.info("github.pr_comment.project_missing", extra={"organization_id": org_id})
        metrics.incr(
            MERGED_PR_METRICS_BASE.format(integration="github", key="error"),
            tags={"type": "missing_project"},
        )
        return

    top_5_issues = get_top_5_issues_by_count(issue_list, project)
    if not top_5_issues:
        logger.info(
            "github.pr_comment.no_issues",
            extra={"organization_id": org_id, "pr_id": pullrequest_id},
        )
        cache.delete(cache_key)
        return

    top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]

    issue_comment_contents = get_comment_contents(top_5_issue_ids)

    try:
        repo = Repository.objects.get(id=gh_repo_id)
    except Repository.DoesNotExist:
        cache.delete(cache_key)
        logger.info("github.pr_comment.repo_missing", extra={"organization_id": org_id})
        metrics.incr(
            MERGED_PR_METRICS_BASE.format(integration="github", key="error"),
            tags={"type": "missing_repo"},
        )
        return

    integration = integration_service.get_integration(
        integration_id=repo.integration_id, status=ObjectStatus.ACTIVE
    )
    if not integration:
        cache.delete(cache_key)
        logger.info("github.pr_comment.integration_missing", extra={"organization_id": org_id})
        metrics.incr(
            MERGED_PR_METRICS_BASE.format(integration="github", key="error"),
            tags={"type": "missing_integration"},
        )
        return

    installation = integration.get_installation(organization_id=org_id)
    assert isinstance(installation, CommitContextIntegration)

    comment_body = format_comment(issue_comment_contents)
    logger.info("github.pr_comment.comment_body", extra={"body": comment_body})

    top_24_issues = issue_list[:24]  # 24 is the P99 for issues-per-PR

    enabled_copilot = features.has("organizations:gen-ai-features", organization)
    github_copilot_actions = (
        [
            {
                "name": f"Root cause #{i + 1}",
                "type": "copilot-chat",
                "prompt": f"@sentry root cause issue {str(issue_id)} with PR URL https://github.com/{repo.name}/pull/{str(pr_key)}",
            }
            for i, issue_id in enumerate(top_24_issues[:3])
        ]
        if enabled_copilot
        else None
    )

    try:
        installation.create_or_update_comment(
            repo=repo,
            pr_key=pr_key,
            comment_body=comment_body,
            pullrequest_id=pullrequest_id,
            issue_list=top_24_issues,
            metrics_base=MERGED_PR_METRICS_BASE,
            github_copilot_actions=github_copilot_actions,
        )
    except ApiError as e:
        cache.delete(cache_key)

        if e.json:
            if ISSUE_LOCKED_ERROR_MESSAGE in e.json.get("message", ""):
                metrics.incr(
                    MERGED_PR_METRICS_BASE.format(integration="github", key="error"),
                    tags={"type": "issue_locked_error"},
                )
                return

            elif RATE_LIMITED_MESSAGE in e.json.get("message", ""):
                metrics.incr(
                    MERGED_PR_METRICS_BASE.format(integration="github", key="error"),
                    tags={"type": "rate_limited_error"},
                )
                return

        metrics.incr(
            MERGED_PR_METRICS_BASE.format(integration="github", key="error"),
            tags={"type": "api_error"},
        )
        raise


@instrumented_task(
    name="sentry.integrations.github.tasks.github_comment_reactions", silo_mode=SiloMode.REGION
)
def github_comment_reactions():
    logger.info("github.pr_comment.reactions_task")

    comments = PullRequestComment.objects.filter(
        created_at__gte=datetime.now(tz=timezone.utc) - timedelta(days=30)
    ).select_related("pull_request")

    comment_count = 0

    for comment in RangeQuerySetWrapper(comments):
        pr = comment.pull_request
        try:
            repo = Repository.objects.get(id=pr.repository_id)
        except Repository.DoesNotExist:
            metrics.incr("pr_comment.comment_reactions.missing_repo")
            continue

        integration = integration_service.get_integration(
            integration_id=repo.integration_id, status=ObjectStatus.ACTIVE
        )
        if not integration:
            logger.info(
                "pr_comment.comment_reactions.integration_missing",
                extra={
                    "organization_id": pr.organization_id,
                },
            )
            metrics.incr("pr_comment.comment_reactions.missing_integration")
            continue

        installation = integration.get_installation(organization_id=pr.organization_id)

        # GitHubApiClient
        # TODO(cathy): create helper function to fetch client for repo
        client = installation.get_client()

        try:
            reactions = client.get_comment_reactions(repo=repo.name, comment_id=comment.external_id)

            comment.reactions = reactions
            comment.save()
        except ApiError as e:
            if e.json and RATE_LIMITED_MESSAGE in e.json.get("message", ""):
                metrics.incr("pr_comment.comment_reactions.rate_limited_error")
                break

            if e.code == 404:
                metrics.incr("pr_comment.comment_reactions.not_found_error")
            else:
                metrics.incr("pr_comment.comment_reactions.api_error")
                sentry_sdk.capture_exception(e)
            continue

        comment_count += 1

        metrics.incr("pr_comment.comment_reactions.success")

    logger.info("pr_comment.comment_reactions.total_collected", extra={"count": comment_count})
