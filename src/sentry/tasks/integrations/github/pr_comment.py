from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List

from django.db import connection
from snuba_sdk import Column, Condition, Direction, Entity, Function, Op, OrderBy, Query
from snuba_sdk import Request as SnubaRequest

from sentry.models import Group, GroupOwnerType, Project
from sentry.utils.snuba import Dataset, raw_snql_query


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


def pr_to_issue_query():

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT pr.repository_id repo_id,
                   pr.key pr_key,
                   pr.organization_id org_id,
                   array_agg(go.group_id) issues
            FROM sentry_groupowner go
            JOIN sentry_commit c ON c.id = (go.context::jsonb->>'commitId')::int
            JOIN sentry_pull_request pr ON c.key = pr.merge_commit_sha
            JOIN sentry_repository repo on pr.repository_id = repo.id
            WHERE go.type=%s
              AND pr.date_added > now() - interval '30 days'
              AND repo.provider = 'integrations:github'
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
